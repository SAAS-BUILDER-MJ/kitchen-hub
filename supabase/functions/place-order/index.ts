import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  notes?: string | null;
}

interface PlaceOrderRequest {
  restaurant_id: string;
  table_id: string;
  qr_token?: string | null;
  items: OrderItem[];
  idempotency_key?: string;
}

// ── In-memory rate limiter ──────────────────────────────────────
// Key: IP or table_id → { count, windowStart }
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_PER_IP = 5; // max 5 orders per IP per minute
const RATE_LIMIT_MAX_PER_TABLE = 3; // max 3 orders per table per minute

function isRateLimited(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return true;
  }
  return false;
}

// Periodic cleanup to prevent memory leak (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 300_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Rate limiting by IP ──────────────────────────────────────
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (clientIP !== "unknown" && isRateLimited(`ip:${clientIP}`, RATE_LIMIT_MAX_PER_IP)) {
      return new Response(JSON.stringify({ error: "Too many orders. Please wait a moment before trying again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: PlaceOrderRequest = await req.json();
  const { restaurant_id, table_id, qr_token, items, idempotency_key } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!restaurant_id || typeof restaurant_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid restaurant_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table_id || typeof table_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid table_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return new Response(JSON.stringify({ error: "Items must be a non-empty array (max 50)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rate limiting by table ─────────────────────────────────────
    if (isRateLimited(`table:${table_id}`, RATE_LIMIT_MAX_PER_TABLE)) {
      return new Response(JSON.stringify({ error: "Too many orders for this table. Please wait before ordering again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== "string") {
        return new Response(JSON.stringify({ error: "Each item must have a valid menu_item_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return new Response(JSON.stringify({ error: `Invalid quantity for item ${item.menu_item_id}. Must be 1-99.` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (item.notes !== undefined && item.notes !== null) {
        if (typeof item.notes !== "string" || item.notes.length > 500) {
          return new Response(JSON.stringify({ error: "Notes must be a string under 500 characters" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // ── Idempotency check ──────────────────────────────────────────
    if (idempotency_key && typeof idempotency_key === "string") {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("idempotency_key", idempotency_key)
        .maybeSingle();

      if (existingOrder) {
        return new Response(JSON.stringify({
          order: { ...existingOrder, items: existingOrder.order_items || [] },
          duplicate: true,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Verify table belongs to restaurant and is active ───────────
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .select("id, restaurant_id, table_number, is_active, qr_code")
      .eq("id", table_id)
      .eq("restaurant_id", restaurant_id)
      .single();

    if (tableError || !table) {
      return new Response(JSON.stringify({ error: "Invalid table. Please scan the QR code again." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!table.is_active) {
      return new Response(JSON.stringify({ error: "This table is currently unavailable." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify QR token matches table (prevents localStorage spoofing) ──
    if (qr_token && typeof qr_token === "string") {
      // Verify the QR token resolves to this exact table
      if (table.qr_code && table.qr_code !== qr_token) {
        return new Response(JSON.stringify({ error: "Invalid table session. Please scan the QR code again." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Validate all menu items: exist, belong to restaurant, available ─
    const menuItemIds = [...new Set(items.map((i) => i.menu_item_id))];
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, restaurant_id, name, price, available, is_deleted")
      .in("id", menuItemIds)
      .eq("restaurant_id", restaurant_id);

    if (menuError) {
      return new Response(JSON.stringify({ error: "Failed to validate menu items" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const menuMap = new Map((menuItems || []).map((m: any) => [m.id, m]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menu_item_id);
      if (!menuItem) {
        return new Response(JSON.stringify({ error: `Menu item not found: ${item.menu_item_id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!menuItem.available || menuItem.is_deleted) {
        return new Response(JSON.stringify({ error: `"${menuItem.name}" is currently unavailable` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Build items array with SERVER-SIDE prices ──────────────────
    const orderItems = items.map((item) => {
      const menuItem = menuMap.get(item.menu_item_id)!;
      return {
        menu_item_id: item.menu_item_id,
        name: menuItem.name,
        price: Number(menuItem.price),
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
      };
    });

    const totalPrice = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // ── ATOMIC order creation via DB function (transaction) ────────
    const { data: orderResult, error: txError } = await supabase.rpc("place_order_tx", {
      _restaurant_id: restaurant_id,
      _table_id: table_id,
      _table_number: table.table_number,
      _total_price: totalPrice,
      _idempotency_key: idempotency_key || null,
      _items: JSON.stringify(orderItems),
    });

    if (txError) {
      // Handle idempotency unique constraint race condition
      if (txError.code === "23505" && idempotency_key) {
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("idempotency_key", idempotency_key)
          .single();
        if (existingOrder) {
          return new Response(JSON.stringify({
            order: { ...existingOrder, items: existingOrder.order_items || [] },
            duplicate: true,
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      console.error("place_order_tx error:", txError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ order: orderResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
