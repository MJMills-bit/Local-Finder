// src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";               // Nominatim dislikes Edge runtime fetch
export const dynamic = "force-dynamic";        // never prerender

const UA = "LocalFinder/1.0 (+you@example.com)"; // per Nominatim policy, use a real contact

type BBox = [minLat: number, minLng: number, maxLat: number, maxLng: number];

// Minimal, strict GeoJSON types (no `any`)
type Position = [number, number]; // [lng, lat]
type PolygonCoords = Position[][];
type MultiPolygonCoords = Position[][][];

type GeoJSONPolygon = { type: "Polygon"; coordinates: PolygonCoords };
type GeoJSONMultiPolygon = { type: "MultiPolygon"; coordinates: MultiPolygonCoords };
type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

// What we return to the client
type GeocodePayload = {
  found: true;
  lat: number;
  lng: number;
  name: string;
  source: "nominatim";
  /** Bounding box as [minLat, minLng, maxLat, maxLng] */
  bbox?: BBox;
  /** Polygon/MultiPolygon in GeoJSON geometry format (when available) */
  polygon?: GeoJSONGeometry;
} | {
  found: false;
  error: string;
  detail?: string;
};

// ---------------------------- Helpers ----------------------------

function buildViewbox(nearLat: number, nearLng: number, radiusKm = 50) {
  const safeCos = Math.max(0.05, Math.cos((nearLat * Math.PI) / 180)); // avoid div by ~0
  const dLat = radiusKm / 111;                  // ~111 km per degree latitude
  const dLng = radiusKm / (111 * safeCos);
  return {
    left: nearLng - dLng,
    right: nearLng + dLng,
    top: nearLat + dLat,
    bottom: nearLat - dLat,
  };
}

/** Convert Nominatim boundingbox (south, north, west, east - as strings)
 *  into [minLat, minLng, maxLat, maxLng] as numbers. */
function parseNominatimBBox(bb: readonly [string, string, string, string]): BBox {
  const south = Number(bb[0]);
  const north = Number(bb[1]);
  const west  = Number(bb[2]);
  const east  = Number(bb[3]);
  // normalised tuple for our client
  return [south, west, north, east];
}

/** Ensure the geojson we pass is a valid Polygon/MultiPolygon with [lng,lat] pairs. */
function normaliseGeoJSON(g: unknown): GeoJSONGeometry | undefined {
  // Nominatim already returns valid GeoJSON; we just validate the shape minimally.
  const obj = g as { type?: string; coordinates?: unknown };
  if (!obj || typeof obj !== "object" || typeof obj.type !== "string") return undefined;

  if (obj.type === "Polygon") {
    // coordinates: Position[][]
    const coords = obj.coordinates as unknown;
    if (Array.isArray(coords) && coords.every(r => Array.isArray(r) && r.every(p => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number"))) {
      return { type: "Polygon", coordinates: coords as PolygonCoords };
    }
    return undefined;
  }

  if (obj.type === "MultiPolygon") {
    // coordinates: Position[][][]
    const coords = obj.coordinates as unknown;
    if (
      Array.isArray(coords) &&
      coords.every(poly =>
        Array.isArray(poly) &&
        poly.every(ring =>
          Array.isArray(ring) &&
          ring.every(p => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number")
        )
      )
    ) {
      return { type: "MultiPolygon", coordinates: coords as MultiPolygonCoords };
    }
    return undefined;
  }

  return undefined;
}

// ---------------------------- Nominatim ----------------------------

type NominatimItem = {
  lat: string;
  lon: string;
  display_name?: string;
  boundingbox?: [string, string, string, string]; // south, north, west, east
  geojson?: unknown; // may be Polygon or MultiPolygon
};

async function queryNominatim(params: Record<string, string>) {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));

  const res = await fetch(u.toString(), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "http://localhost:3000",
    },
    // polite server cache
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  return (await res.json()) as NominatimItem[];
}

// ---------------------------- Route ----------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const q = (searchParams.get("q") || "").trim();
    const nearLat = Number(searchParams.get("nearLat"));
    const nearLng = Number(searchParams.get("nearLng"));
    const radiusKm = Number(searchParams.get("radiusKm") || 50);

    if (!q) {
      const payload: GeocodePayload = { found: false, error: "Missing q" };
      return NextResponse.json(payload, { status: 400 });
    }

    const base: Record<string, string> = {
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "za",         // keep results in South Africa (adjust if needed)
      q,
      polygon_geojson: "1",       // <-- ask for polygon if available
      extratags: "1",
    };

    // 1) try location-biased search
    let results: NominatimItem[] = [];
    if (Number.isFinite(nearLat) && Number.isFinite(nearLng)) {
      const box = buildViewbox(nearLat, nearLng, radiusKm);
      results = await queryNominatim({
        ...base,
        viewbox: `${box.left},${box.top},${box.right},${box.bottom}`,
        bounded: "0", // bias but don't clamp strictly
      });
    }

    // 2) fallback: ZA-only without bias
    if (results.length === 0) {
      results = await queryNominatim(base);
    }

    if (results.length === 0) {
      const payload: GeocodePayload = { found: false, error: "Not found" };
      return NextResponse.json(payload, { status: 404 });
    }

    // choose first result
    const best = results[0];
    const lat = Number(best.lat);
    const lng = Number(best.lon);
    const name = (best.display_name?.split(",")[0] as string | undefined) || q;

    // Optional bbox + polygon
    const bbox = best.boundingbox ? parseNominatimBBox(best.boundingbox) : undefined;
    const polygon = best.geojson ? normaliseGeoJSON(best.geojson) : undefined;

    const payload: GeocodePayload = {
      found: true,
      lat,
      lng,
      name,
      source: "nominatim",
      ...(bbox ? { bbox } : {}),
      ...(polygon ? { polygon } : {}),
    };

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    const payload: GeocodePayload = {
      found: false,
      error: "Geocode failed",
      detail: String(err),
    };
    return NextResponse.json(payload, { status: 502 });
  }
}
