import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return respond({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Menu endpoint is missing server configuration");
    return respond({ ok: false, error: "Server configuration error" }, 500);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: products, error: productError }, { data: locations, error: locationError }, { data: staffAssignments, error: staffError }, { data: inventory, error: inventoryError }, { data: runtimeSettings, error: settingsError }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name_ru, name_vi, name_en, description_ru, description_vi, description_en, price_vnd, weight_value, weight_unit, image_url, sku, catalog_preview")
        .eq("product_type", "cafe")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("locations")
        .select("id, name, address, city, country, latitude, longitude, delivery_zone")
        .eq("location_type", "cafe")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("cafe_staff")
        .select("location_id")
        .eq("is_active", true),
      supabase
        .from("inventory")
        .select("product_id,location_id,quantity,reserved_quantity,price_vnd,is_available"),
      supabase
        .from("umma_runtime_settings")
        .select("inventory_control_enabled")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (productError || locationError || staffError || inventoryError || settingsError) {
      console.error("Menu lookup failed", productError?.message, locationError?.message, staffError?.message, inventoryError?.message);
      return respond({ ok: false, error: "Could not load cafe menu" }, 500);
    }

    const staffedLocationIds = new Set((staffAssignments ?? []).map((item) => item.location_id));
    const availableLocations = (locations ?? []).filter((item) => staffedLocationIds.has(item.id));

    return respond({
      ok: true,
      currency: "VND",
      products: products ?? [],
      inventory: inventory ?? [],
      inventoryControlEnabled: runtimeSettings?.inventory_control_enabled === true,
      locations: availableLocations,
      location: availableLocations.find((item) => item.name.toLowerCase().includes("halal umma")) ?? availableLocations[0] ?? null,
    });
  } catch (error) {
    console.error("Cafe menu failed", error);
    return respond({ ok: false, error: "Could not load cafe menu" }, 500);
  }
});
