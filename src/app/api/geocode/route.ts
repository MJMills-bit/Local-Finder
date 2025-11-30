// src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nominatim requires an identifying User-Agent with contact info.
// You can override this with NOMINATIM_UA in your env if you like.
const DEFAULT_UA =
  "LocalFinder/1.0 (https://zasupport.com; admin@zasupport.com)";
const UA = process.env.NOMINATIM_UA ?? DEFAULT_UA;

type BBox = [number, number, number, number];

type Position = [number, number]; // [lng, lat] per GeoJSON
type PolygonCoords = Position[][];
type MultiPolygonCoords = Position[][][];

type GeoJSONPolygon = { type: "Polygon"; coordinates: PolygonCoords };
type GeoJSONMultiPolygon = {
  type: "MultiPolygon";
  coordinates: MultiPolygonCoords;
};
type GeoJSONPoly = GeoJSONPolygon | GeoJSONMultiPolygon;

type GeocodeFound = {
  found: true;
  lat: number;
  lng: number;
  name: string;
  source: "nominatim";
  bbox?: BBox;
  polygon?: GeoJSONPoly;
};

type GeocodeNotFound = {
  found: false;
  error: string;
  detail?: string;
};

type GeocodePayload = GeocodeFound | GeocodeNotFound;

// Nominatim result shape (simplified to only fields we use)
type NominatimBBox = [string, string, string, string];

type NominatimGeoJSON =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: MultiPolygonCoords };

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  boundingbox?: NominatimBBox;
  geojson?: NominatimGeoJSON;
}

// Simple in-memory cache to avoid hammering Nominatim in dev.
interface CacheEntry {
  ts: number;
  payload: GeocodePayload;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function toNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseBBox(bb?: NominatimBBox): BBox | undefined {
  if (!bb || bb.length !== 4) return undefined;
  const south = toNumber(bb[0]);
  const north = toNumber(bb[1]);
  const west = toNumber(bb[2]);
  const east = toNumber(bb[3]);
  if (south == null || north == null || west == null || east == null) {
    return undefined;
  }
  return [south, west, north, east];
}

function makeCacheKey(q: string, nearLat?: number, nearLng?: number): string {
  const latPart = typeof nearLat === "number" ? nearLat.toFixed(4) : "nil";
  const lngPart = typeof nearLng === "number" ? nearLng.toFixed(4) : "nil";
  return `${q.toLowerCase()}|${latPart}|${lngPart}`;
}

function getCached(key: string): GeocodePayload | undefined {
  const entry = CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return undefined;
  }
  return entry.payload;
}

function setCached(key: string, payload: GeocodePayload): void {
  CACHE.set(key, { ts: Date.now(), payload });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const nearLat = toNumber(url.searchParams.get("nearLat"));
  const nearLng = toNumber(url.searchParams.get("nearLng"));

  // NEW: read both radiusKm (km) and radius (meters) for backward compat
  const radiusKmParam = toNumber(url.searchParams.get("radiusKm"));
  const radiusMetersParam = toNumber(url.searchParams.get("radius"));

  if (!q) {
    const payload: GeocodeNotFound = {
      found: false,
      error: "Empty query",
    };
    return NextResponse.json<GeocodePayload>(payload, { status: 200 });
  }

  const cacheKey = makeCacheKey(q, nearLat, nearLng);
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json<GeocodePayload>(cached, { status: 200 });
  }

  try {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "0",
      polygon_geojson: "1",
      limit: "1",
    });

    if (nearLat != null && nearLng != null) {
      // Use radiusKm if provided, else raw radius in meters, else default 10km
      const radiusMeters =
        radiusKmParam && radiusKmParam > 0
          ? radiusKmParam * 1000
          : radiusMetersParam && radiusMetersParam > 0
          ? radiusMetersParam
          : 10_000;

      const latDelta = radiusMeters / 111_000;
      const lngDelta =
        radiusMeters /
        (111_000 * Math.cos((nearLat * Math.PI) / 180) || 1);

      const minLat = nearLat - latDelta;
      const maxLat = nearLat + latDelta;
      const minLng = nearLng - lngDelta;
      const maxLng = nearLng + lngDelta;

      params.set("viewbox", `${minLng},${maxLat},${maxLng},${minLat}`);
      params.set("bounded", "1");

      params.set("lat", String(nearLat));
      params.set("lon", String(nearLng));
    }


    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });

    // If upstream fails (403, 429, 5xx), we still return 200 to the client.
    if (!res.ok) {
      const payload: GeocodeNotFound = {
        found: false,
        error: "Geocode failed",
        detail: `Upstream ${res.status} ${res.statusText}`,
      };
      setCached(cacheKey, payload);
      return NextResponse.json<GeocodePayload>(payload, { status: 200 });
    }

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      const payload: GeocodeNotFound = {
        found: false,
        error: "Unexpected response shape",
      };
      setCached(cacheKey, payload);
      return NextResponse.json<GeocodePayload>(payload, { status: 200 });
    }

    const results = json as NominatimResult[];
    if (results.length === 0) {
      const payload: GeocodeNotFound = {
        found: false,
        error: "No results",
      };
      setCached(cacheKey, payload);
      return NextResponse.json<GeocodePayload>(payload, { status: 200 });
    }

    const first = results[0];
    const lat = toNumber(first.lat);
    const lng = toNumber(first.lon);

    if (lat == null || lng == null) {
      const payload: GeocodeNotFound = {
        found: false,
        error: "Result missing coordinates",
      };
      setCached(cacheKey, payload);
      return NextResponse.json<GeocodePayload>(payload, { status: 200 });
    }

    const bbox = parseBBox(first.boundingbox);
    const polygon = first.geojson;

    const payload: GeocodeFound = {
      found: true,
      lat,
      lng,
      name: first.display_name || q,
      source: "nominatim",
      bbox,
      polygon,
    };

    setCached(cacheKey, payload);

    return NextResponse.json<GeocodePayload>(payload, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const payload: GeocodeNotFound = {
      found: false,
      error: "Geocode failed",
      detail: String(err),
    };
    setCached(cacheKey, payload);
    return NextResponse.json<GeocodePayload>(payload, { status: 200 });
  }
}
