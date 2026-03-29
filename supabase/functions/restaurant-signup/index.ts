import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { restaurant_name, phone, address } = await req.json();

    if (!restaurant_name || typeof restaurant_name !== "string" || restaurant_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Restaurant name is required (min 2 characters)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for writes
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already has a restaurant
    const { data: existingRoles } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (existingRoles && existingRoles.length > 0) {
      return new Response(JSON.stringify({ error: "You already have a restaurant. Go to your dashboard." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create restaurant
    const { data: restaurant, error: restError } = await adminClient
      .from("restaurants")
      .insert({
        name: restaurant_name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      })
      .select()
      .single();

    if (restError) {
      return new Response(JSON.stringify({ error: "Failed to create restaurant: " + restError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign admin role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: user.id,
        role: "admin",
        restaurant_id: restaurant.id,
      });

    if (roleError) {
      // Rollback restaurant
      await adminClient.from("restaurants").delete().eq("id", restaurant.id);
      return new Response(JSON.stringify({ error: "Failed to assign role: " + roleError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create default tables (1-5)
    const tables = Array.from({ length: 5 }, (_, i) => ({
      restaurant_id: restaurant.id,
      table_number: i + 1,
    }));
    await adminClient.from("tables").insert(tables);

    // Create default categories
    const defaultCategories = ["Appetizers", "Main Course", "Desserts", "Beverages"];
    const cats = defaultCategories.map((name, i) => ({
      restaurant_id: restaurant.id,
      name,
      sort_order: i,
    }));
    await adminClient.from("menu_categories").insert(cats);

    return new Response(JSON.stringify({
      restaurant_id: restaurant.id,
      message: "Restaurant created successfully",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error: " + (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
