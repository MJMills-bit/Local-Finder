// src/app/api/overpass/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Place } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Overpass servers expect an identifying User-Agent.
// You can override this with OVERPASS_UA in your env.
const DEFAULT_UA =
  "LocalFinder/1.0 (https://zasupport.com; admin@zasupport.com)";
const USER_AGENT = process.env.OVERPASS_UA ?? DEFAULT_UA;

// Primary and fallback Overpass mirrors
const OVERPASS_MIRRORS: readonly string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

type OverpassElementType = "node" | "way" | "relation";

interface OverpassCenter {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: OverpassElementType;
  id: number;
  lat?: number;
  lon?: number;
  center?: OverpassCenter;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface CacheEntry {
  ts: number;
  data: Place[];
}

// Simple in-memory cache
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function clampRadius(radius: number | undefined): number {
  // Default to 3000 m (3 km) if nothing sensible is passed
  if (!Number.isFinite(radius ?? NaN)) return 3000;
  const r = radius as number;
  // Allow between 150 m and 30 km
  return Math.max(150, Math.min(r, 30_000));
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Map frontend categories to Overpass tag filters
function buildCategoryFilters(category: string | null): string[] {
  const cat = (category ?? "all").toLowerCase();

  if (cat === "coffee") {
    return [
      '["amenity"="cafe"]',
      '["amenity"="coffee"]',
      '["amenity"="coffee_shop"]',
      '["shop"="coffee"]',
    ];
  }

  if (cat === "clinic") {
    return [
      '["amenity"="clinic"]',
      '["healthcare"="clinic"]',
      '["amenity"="doctors"]',
    ];
  }

  if (cat === "coworking") {
    return ['["office"="coworking"]', '["amenity"="coworking_space"]'];
  }

  // Generic set used when category is "all" or another unsupported value.
  return [
    '["amenity"]',
    '["shop"]',
    '["office"="coworking"]',
    '["healthcare"]',
  ];
}

// Category-based query (no free-text search)
function buildOverpassQuery(
  lat: number,
  lng: number,
  radius: number,
  category: string | null,
): string {
  const filters = buildCategoryFilters(category);
  const around = `around:${radius},${lat},${lng}`;

  const blocks = filters.map(
    (f) => `
      node${f}(${around});
      way${f}(${around});
      relation${f}(${around});
    `,
  );

  return `
    [out:json][timeout:25];
    (
      ${blocks.join("\n")}
    );
    out center tags 200;
  `;
}

async function fetchWithTimeout(
  url: string,
  body: string,
  timeoutMs: number,
): Promise<OverpassResponse | null> {
  const ctrl = new AbortController();
  const timeoutHandle = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      // Non-200 (e.g. 429, 504) – treat as failure
      return null;
    }

    const json = (await res.json()) as OverpassResponse;

    if (!json || typeof json !== "object" || !Array.isArray(json.elements)) {
      return null;
    }

    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// Normalise Overpass JSON into Place[]
function normaliseElements(
  elements: OverpassElement[],
  requestedCategory: string | null,
): Place[] {
  const places: Place[] = [];
  const requested = (requestedCategory ?? "all").toLowerCase();

  for (const el of elements) {
    const tags = el.tags ?? {};
    const center: OverpassCenter | null =
      el.type === "node"
        ? el.lat !== undefined && el.lon !== undefined
          ? { lat: el.lat, lon: el.lon }
          : null
        : el.center ?? null;

    if (!center) continue;

    // Default category
    let category: string = "other";

    if (
      tags.amenity === "cafe" ||
      tags.amenity === "coffee" ||
      tags.amenity === "coffee_shop" ||
      tags.shop === "coffee"
    ) {
      category = "coffee";
    } else if (
      tags.amenity === "clinic" ||
      tags.healthcare === "clinic" ||
      tags.amenity === "doctors"
    ) {
      category = "clinic";
    } else if (
      tags.office === "coworking" ||
      tags.amenity === "coworking_space"
    ) {
      category = "coworking";
    } else if (tags.amenity === "restaurant") {
      category = "restaurant";
    } else if (tags.amenity === "bar") {
      category = "bar";
    } else if (tags.shop === "supermarket") {
      category = "supermarket";
    } else if (tags.amenity === "pharmacy") {
      category = "pharmacy";
    }

    // If category filter is not "all", enforce it server-side as well
    if (requested !== "all" && category !== requested) {
      continue;
    }

    const addressParts = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:city"],
    ].filter(Boolean);

    const address =
      tags["addr:full"] ||
      (addressParts.length ? addressParts.join(", ") : undefined);

    const rawName =
  tags.name ||
  tags["name:en"] ||
  tags.brand ||
  tags.operator ||
  tags["official_name"] ||
  tags["alt_name"] ||
  tags["short_name"] ||
  tags["addr:housename"] ||
  tags["addr:place"] ||
  // last-ditch heuristics, optional:
  (tags.shop && tags.brand ? `${tags.brand} ${tags.shop}` : undefined) ||
  (tags.amenity && tags.brand ? `${tags.brand} ${tags.amenity}` : undefined);

const place: Place = {
  id: `${el.type}/${el.id}`,
  lat: center.lat,
  lng: center.lon,
  name: rawName || "Unnamed place",
  address,
  tags,
  category: category as Place["category"],
};


    places.push(place);
  }

  return places;
}

// ------- Handler ----------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const lat = parseNumber(searchParams.get("lat"));
  const lng = parseNumber(searchParams.get("lng"));
  const radiusParam = parseNumber(searchParams.get("radius"));
  const category = searchParams.get("category");

  if (lat === undefined || lng === undefined) {
    return NextResponse.json(
      { error: "Missing lat/lng", data: [] as Place[] },
      { status: 400 },
    );
  }

  const radius = clampRadius(radiusParam);

  const cacheKey = `${lat.toFixed(5)}|${lng.toFixed(5)}|${radius}|${
    category ?? "all"
  }`;
  const now = Date.now();

  const cached = CACHE.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { status: 200 });
  }

  const overpassQuery = buildOverpassQuery(lat, lng, radius, category);
  const body = `data=${encodeURIComponent(overpassQuery)}`;

  let response: OverpassResponse | null = null;

  // Try mirrors with timeouts; if all fail, return an empty dataset gracefully
  for (const mirror of OVERPASS_MIRRORS) {
    response = await fetchWithTimeout(mirror, body, 25_000);
    if (response) break;
  }

  if (!response) {
    const payload = {
      error: "Overpass failed or timed out",
      data: [] as Place[],
    };
    return NextResponse.json(payload, { status: 200 });
  }

  const places = normaliseElements(response.elements, category);
  CACHE.set(cacheKey, { ts: now, data: places });

  return NextResponse.json(places, { status: 200 });
}
