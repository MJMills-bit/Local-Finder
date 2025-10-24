// src/app/api/overpass/route.ts
import { NextResponse } from "next/server";
import type { Category, Place } from "@/lib/useStore";

/* ---------- Types ---------- */
type OSMTags = Record<string, string>;
type OSMCenter = { lat: number; lon: number };
type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: OSMCenter;
  tags?: OSMTags;
};
type OSMResponse = { elements: OSMElement[] };

const UA = "LocalFinder/1.1 (contact: support@localfinder.dev)";

/* ---------- Helpers ---------- */
function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasFinite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function pickName(tags: OSMTags): string | undefined {
  return (
    tags.name ||
    tags.brand ||
    tags.operator ||
    // last-resort: use a meaningful tag as a label so cards still render
    (tags.amenity ? `${tags.amenity}` : undefined) ||
    (tags.shop ? `${tags.shop}` : undefined) ||
    (tags.tourism ? `${tags.tourism}` : undefined)
  );
}

function pickAddress(tags: OSMTags): string | undefined {
  const full = tags["addr:full"];
  if (full) return full;
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function mapTagsToCategory(tags: OSMTags, fallback: Category): Category {
  // amenity-based
  if (tags.amenity === "cafe") return "coffee";
  if (tags.amenity === "clinic") return "clinic";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "fast_food") return "fastfood";
  if (tags.amenity === "bar") return "bar";
  if (tags.amenity === "pub") return "pub";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "bank") return "bank";
  if (tags.amenity === "atm") return "atm";
  if (tags.amenity === "fuel") return "fuel";

  // shop-based
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.shop) return "shop";

  // tourism / leisure
  if (tags.tourism === "hotel") return "hotel";
  if (tags.tourism === "attraction") return "attraction";
  if (tags.leisure === "park") return "park";

  // office
  if (tags.office === "coworking") return "coworking";

  return fallback;
}

function elementToPlace(el: OSMElement, fallback: Category): Place | null {
  const lat = hasFinite(el.lat) ? el.lat : hasFinite(el.center?.lat) ? el.center!.lat : undefined;
  const lng = hasFinite(el.lon) ? el.lon : hasFinite(el.center?.lon) ? el.center!.lon : undefined;
  if (!hasFinite(lat) || !hasFinite(lng)) return null;

  const tags: OSMTags = el.tags ?? {};
  const finalName = pickName(tags) ?? "Unnamed place";
  const address = pickAddress(tags);
  const category = mapTagsToCategory(tags, fallback);

  return {
    id: String(el.id),
    name: finalName,
    lat,
    lng,
    category,
    address,
    tags,
  };
}

/* ---------- Query builder ---------- */
function buildQuery(
  lat: number,
  lng: number,
  radiusM: number,
  category: Category,
  q?: string
): string {
  const text = q?.trim();
  const rx = text ? escapeRegex(text) : "";
  const filter = text ? `[~"^(name|brand|operator)$"~"${rx}",i]` : "";

  const queryBase = (selector: string) =>
    `nwr(around:${radiusM},${lat},${lng})${selector}${filter};`;

  const selectors: Record<Category, string> = {
    all: `
      ${queryBase("[amenity]")}
      ${queryBase("[shop]")}
    `,
    coffee: queryBase("[amenity=cafe]"),
    clinic: queryBase("[amenity=clinic]"),
    coworking: queryBase("[office=coworking]"),
    restaurant: queryBase("[amenity=restaurant]"),
    attraction: queryBase("[tourism=attraction]"),
    shop: queryBase("[shop]"),
    supermarket: queryBase("[shop=supermarket]"),
    pharmacy: queryBase("[amenity=pharmacy]"),
    pub: queryBase("[amenity=pub]"),
    bar: queryBase("[amenity=bar]"),
    fastfood: queryBase("[amenity=fast_food]"),
    hotel: queryBase("[tourism=hotel]"),
    hospital: queryBase("[amenity=hospital]"),
    bank: queryBase("[amenity=bank]"),
    atm: queryBase("[amenity=atm]"),
    fuel: queryBase("[amenity=fuel]"),
    park: queryBase("[leisure=park]"),
  };

  return `
    [out:json][timeout:25];
    (
      ${selectors[category] ?? selectors["all"]}
    );
    out center qt;
  `;
}

/* ---------- Overpass API call ---------- */
async function callOverpass(query: string, endpoint: string): Promise<OSMResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Accept: "application/json",
    },
    body: new URLSearchParams({ data: query }).toString(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

/* ---------- API Route ---------- */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const radius = Number(searchParams.get("radius") ?? "3000");
    const category = (searchParams.get("category") ?? "all") as Category;
    const q = searchParams.get("q") ?? undefined;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      // Keep 200 so client code can easily branch on empty `data`
      return NextResponse.json({ error: "lat/lng required", data: [] }, { status: 200 });
    }

    const ql = buildQuery(lat, lng, Math.max(50, Math.floor(radius)), category, q);

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    for (const ep of endpoints) {
      try {
        const json = await callOverpass(ql, ep);
        const places: Place[] = json.elements
          .map((e) => elementToPlace(e, category))
          .filter((x): x is Place => x !== null);

        // Always return an array so the client can render confidently
        return NextResponse.json(places, {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        });
      } catch {
        // try next mirror
        continue;
      }
    }

    return NextResponse.json({ error: "All Overpass mirrors failed", data: [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Overpass error",
        detail: String(err),
        data: [],
      },
      { status: 200 }
    );
  }
}
