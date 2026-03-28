import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModifyItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

interface ModifyRequest {
  order_id: string;
  table_id: string; // For ownership verification
  items: ModifyItem[];
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
    const { order_id, table_id, items } = body;

    // --- Input validation ---
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

    // Validate each item
    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== "string") {
        return new Response(JSON.stringify({ error: "Each item must have a valid menu_item_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return new Response(JSON.stringify({ error: `Invalid quantity for ${item.name || item.menu_item_id}. Must be 1-99.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof item.price !== "number" || item.price < 0) {
        return new Response(JSON.stringify({ error: `Invalid price for ${item.name || item.menu_item_id}` }), {
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

    // --- Fetch order and verify ownership + status ---
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, table_id, restaurant_id, status")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership: table_id must match
    if (order.table_id !== table_id) {
      return new Response(JSON.stringify({ error: "You are not authorized to modify this order" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status check
    const modifiableStatuses = ["NEW", "PREPARING"];
    if (!modifiableStatuses.includes(order.status)) {
      return new Response(JSON.stringify({
        error: `Order cannot be modified. Current status: ${order.status}. Modifications are only allowed when the order is NEW or PREPARING.`,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Validate all menu items belong to the same restaurant ---
    const menuItemIds = items.map((i) => i.menu_item_id);
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, price, available, is_deleted")
      .in("id", menuItemIds);

    if (menuError) {
      return new Response(JSON.stringify({ error: "Failed to validate menu items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const menuMap = new Map((menuItems || []).map((m: any) => [m.id, m]));
    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) {
        return new Response(JSON.stringify({ error: `Menu item not found: ${item.name || item.menu_item_id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (menuItem.restaurant_id !== order.restaurant_id) {
        return new Response(JSON.stringify({ error: `Item "${item.name}" does not belong to this restaurant` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!menuItem.available || menuItem.is_deleted) {
        return new Response(JSON.stringify({ error: `Item "${item.name}" is currently unavailable` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- Re-check status right before mutation (optimistic concurrency) ---
    const { data: freshOrder, error: freshError } = await supabase
      .from("orders")
      .select("status")
      .eq("id", order_id)
      .single();

    if (freshError || !freshOrder || !modifiableStatuses.includes(freshOrder.status)) {
      return new Response(JSON.stringify({
        error: "Order status changed while processing. Please refresh and try again.",
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Atomic modification: delete old items, insert new, update total ---
    // 1. Delete existing order items
    const { error: deleteError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", order_id);

    if (deleteError) {
      return new Response(JSON.stringify({ error: "Failed to update order items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Insert new items
    const newItems = items.map((i) => ({
      order_id,
      menu_item_id: i.menu_item_id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      notes: i.notes || null,
    }));

    const { error: insertError } = await supabase
      .from("order_items")
      .insert(newItems);

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to insert updated items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Recalculate total and update order
    const newTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ total_price: newTotal, updated_at: new Date().toISOString() })
      .eq("id", order_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update order total" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch updated order
    const { data: updatedOrder, error: fetchError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (fetchError) {
      return new Response(JSON.stringify({ error: "Order updated but failed to fetch result" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: { ...updatedOrder, items: updatedOrder.order_items || [] },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
