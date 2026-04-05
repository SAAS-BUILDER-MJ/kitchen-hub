import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRACE_PERIOD_MS = 60_000; // 60 seconds

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { order_id, cancelled_by, reason } = body;

    // Input validation
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCancelledBy = ["customer", "staff"];
    if (!cancelled_by || !validCancelledBy.includes(cancelled_by)) {
      return new Response(JSON.stringify({ error: "cancelled_by must be 'customer' or 'staff'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, created_at, restaurant_id")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already cancelled
    if (order.status === "CANCELLED") {
      return new Response(JSON.stringify({ error: "Order is already cancelled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Customer cancellations: enforce grace period + status must be NEW
    if (cancelled_by === "customer") {
      if (order.status !== "NEW") {
        return new Response(JSON.stringify({ error: "Order is already being prepared and cannot be cancelled" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const elapsed = Date.now() - new Date(order.created_at).getTime();
      if (elapsed > GRACE_PERIOD_MS) {
        return new Response(JSON.stringify({ error: "Cancellation grace period has expired" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Staff cancellations: must check auth and role
    if (cancelled_by === "staff") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authentication required for staff cancellation" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check restaurant-scoped role (admin or chef can cancel)
      const { data: isAdmin } = await supabase.rpc("has_restaurant_role", {
        _user_id: user.id,
        _role: "admin",
        _restaurant_id: order.restaurant_id,
      });
      const { data: isChef } = await supabase.rpc("has_restaurant_role", {
        _user_id: user.id,
        _role: "chef",
        _restaurant_id: order.restaurant_id,
      });

      if (!isAdmin && !isChef) {
        return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Staff can cancel NEW or PREPARING orders
      if (!["NEW", "PREPARING"].includes(order.status)) {
        return new Response(JSON.stringify({ error: `Cannot cancel order with status ${order.status}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Perform cancellation using service role (bypasses RLS)
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "CANCELLED",
        cancelled_by,
        cancel_reason: reason?.trim()?.substring(0, 500) || null,
      })
      .eq("id", order_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to cancel order: " + updateError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
