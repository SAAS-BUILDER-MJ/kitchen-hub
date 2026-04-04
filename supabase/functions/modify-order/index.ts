import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModifyItem {
  menu_item_id: string;
  quantity: number;
  notes?: string | null;
}

interface ModifyRequest {
  order_id: string;
  table_id: string;
  items: ModifyItem[];
  expected_updated_at?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: ModifyRequest = await req.json();
    const { order_id, table_id, items, expected_updated_at } = body;

    // Basic input validation
    if (!order_id || typeof order_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table_id || typeof table_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid table_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Items array is required and must not be empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each item structure (prices are NOT accepted — server looks them up)
    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== "string") {
        return new Response(JSON.stringify({ error: "Each item must have a valid menu_item_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return new Response(JSON.stringify({ error: `Invalid quantity for ${item.menu_item_id}. Must be 1-99.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (item.notes && typeof item.notes !== "string") {
        return new Response(JSON.stringify({ error: "Notes must be a string" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (item.notes && item.notes.length > 500) {
        return new Response(JSON.stringify({ error: "Notes must be under 500 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Call atomic DB function — handles price lookup, validation, and modification in one transaction
    const itemsPayload = items.map((i) => ({
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
      notes: i.notes || null,
    }));

    const { data, error: rpcError } = await supabase.rpc("modify_order_tx", {
      _order_id: order_id,
      _table_id: table_id,
      _items: JSON.stringify(itemsPayload),
    });

    if (rpcError) {
      // Parse Postgres exception messages for user-friendly errors
      const msg = rpcError.message || "Failed to modify order";
      const status = msg.includes("not found") ? 404
        : msg.includes("Not authorized") ? 403
        : msg.includes("cannot be modified") ? 409
        : msg.includes("unavailable") ? 400
        : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, order: { ...data, items: data.items || [] } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
