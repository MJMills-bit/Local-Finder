// src/lib/osm-client.ts
import type { Place, Category } from "@/lib/useStore";

/**
 * Map a single Overpass element (node/way/relation) to a Place.
 * Returns null if the element has no usable coords or name.
 */
export function toPlace(
  el: {
    type: "node" | "way" | "relation";
    id: number | string;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  },
  fallbackCategory: Category | string
): Place | null {
  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lng = el.type === "node" ? el.lon : el.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const tags = el.tags ?? {};
  // prefer name; otherwise show something clear enough
  const name =
    tags.name ||
    tags.brand ||
    tags.operator ||
    tags.shop ||
    tags.amenity ||
    `POI #${el.id}`;

  // derive category from common tags; fall back to filter used
  let category: Category | string = fallbackCategory;
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";

  if (amenity === "cafe") category = "coffee";
  else if (amenity === "clinic") category = "clinic";
  else if (amenity === "coworking_space") category = "coworking";
  else if (amenity === "restaurant") category = "restaurant" as Category;
  else if (amenity === "fast_food") category = "fast_food" as Category;
  else if (amenity === "fuel") category = "fuel" as Category;
  else if (shop) category = "shop" as Category;

  const addr =
    tags["addr:full"] ||
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");

  return {
    id: String(el.id),
    name,
    lat,
    lng,
    category: category as Category,
    address: addr || undefined,
    tags: Object.keys(tags),
  };
}
