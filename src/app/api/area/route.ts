// src/app/api/area/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "LocalFinder/1.0 (+you@example.com)"; // please put a real contact per Nominatim policy

// --------------------------- Shared Geo Types ---------------------------

type BBox = [minLat: number, minLng: number, maxLat: number, maxLng: number];

type Position = [number, number]; // [lng, lat]
type PolygonCoords = Position[][];
type MultiPolygonCoords = Position[][][];

// Strict GeoJSON (subset we need)
type GeoJSONPolygon = { type: "Polygon"; coordinates: PolygonCoords };
type GeoJSONMultiPolygon = { type: "MultiPolygon"; coordinates: MultiPolygonCoords };
type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

// Response payload
type AreaPayload =
  | {
      found: true;
      lat: number; // centroid
      lng: number;
      name: string;
      source: "nominatim" | "overpass";
      bbox?: BBox;
      polygon?: GeoJSONGeometry;
    }
  | {
      found: false;
      error: string;
      detail?: string;
    };

// --------------------------- Helpers ---------------------------

function buildViewbox(nearLat: number, nearLng: number, radiusKm = 50) {
  const safeCos = Math.max(0.05, Math.cos((nearLat * Math.PI) / 180));
  const dLat = radiusKm / 111; // ~111km per degree lat
  const dLng = radiusKm / (111 * safeCos);
  return {
    left: nearLng - dLng,
    right: nearLng + dLng,
    top: nearLat + dLat,
    bottom: nearLat - dLat,
  };
}

function parseNominatimBBox(bb: readonly [string, string, string, string]): BBox {
  const south = Number(bb[0]);
  const north = Number(bb[1]);
  const west = Number(bb[2]);
  const east = Number(bb[3]);
  return [south, west, north, east];
}

function toCentroidFromBBox(bbox: BBox): { lat: number; lng: number } {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

function normaliseGeoJSON(g: unknown): GeoJSONGeometry | undefined {
  const obj = g as { type?: string; coordinates?: unknown };
  if (!obj || typeof obj !== "object" || typeof obj.type !== "string") return undefined;

  if (obj.type === "Polygon") {
    const coords = obj.coordinates as unknown;
    const ok =
      Array.isArray(coords) &&
      coords.every(
        (ring) =>
          Array.isArray(ring) &&
          ring.every(
            (pt) =>
              Array.isArray(pt) &&
              pt.length === 2 &&
              typeof pt[0] === "number" &&
              typeof pt[1] === "number"
          )
      );
    return ok ? ({ type: "Polygon", coordinates: coords as PolygonCoords } satisfies GeoJSONPolygon) : undefined;
  }

  if (obj.type === "MultiPolygon") {
    const coords = obj.coordinates as unknown;
    const ok =
      Array.isArray(coords) &&
      coords.every(
        (poly) =>
          Array.isArray(poly) &&
          poly.every(
            (ring) =>
              Array.isArray(ring) &&
              ring.every(
                (pt) =>
                  Array.isArray(pt) &&
                  pt.length === 2 &&
                  typeof pt[0] === "number" &&
                  typeof pt[1] === "number"
              )
          )
      );
    return ok
      ? ({ type: "MultiPolygon", coordinates: coords as MultiPolygonCoords } satisfies GeoJSONMultiPolygon)
      : undefined;
  }

  return undefined;
}

// --------------------------- Nominatim ---------------------------

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
  boundingbox?: [string, string, string, string]; // south, north, west, east
  geojson?: unknown; // Polygon/MultiPolygon when available (with polygon_geojson=1)
};

async function nominatimSearch(params: Record<string, string>): Promise<NominatimResult[]> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));

  const res = await fetch(u.toString(), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      Referer: "http://localhost:3000",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return (await res.json()) as NominatimResult[];
}

// --------------------------- Overpass (fallback for relations) ---------------------------

type OverpassGeometryPoint = { lat: number; lon: number };

type OverpassRelation = {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  // Overpass can return either geometry (list of points) or a center/bounds object depending on query
  geometry?: OverpassGeometryPoint[]; // if we asked for out geom;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  center?: { lat: number; lon: number };
};

type OverpassResponse = { elements?: OverpassRelation[] };

async function overpassAreaByName(name: string): Promise<OverpassResponse> {
  // We ask for admin boundary or place=* relations that match name (case-insensitive).
  // Using `out center;` to guarantee at least a centroid; you can switch to `out geom;` to get full geometry
  // but that is heavier and times out more often on public servers.
  const query = `
[out:json][timeout:25];
(
  relation["boundary"="administrative"]["name"~"${name}",i];
  relation["place"]["name"~"${name}",i];
);
out center bb;
`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain", "User-Agent": UA },
    body: query,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as OverpassResponse;
  return json;
}

// --------------------------- Route ---------------------------

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const nearLat = Number(sp.get("nearLat"));
    const nearLng = Number(sp.get("nearLng"));
    const radiusKm = Number(sp.get("radiusKm") || 50);

    if (!q) {
      const p: AreaPayload = { found: false, error: "Missing q" };
      return NextResponse.json(p, { status: 400 });
    }

    // 1) Nominatim first (fast, often returns polygon)
    const base: Record<string, string> = {
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "za",
      q,
      polygon_geojson: "1",
    };

    let nomi: NominatimResult[] = [];
    if (Number.isFinite(nearLat) && Number.isFinite(nearLng)) {
      const vb = buildViewbox(nearLat, nearLng, radiusKm);
      nomi = await nominatimSearch({
        ...base,
        viewbox: `${vb.left},${vb.top},${vb.right},${vb.bottom}`,
        bounded: "0",
      });
    }
    if (nomi.length === 0) nomi = await nominatimSearch(base);

    if (nomi.length > 0) {
      // best = first
      const best = nomi[0];
      const lat = Number(best.lat);
      const lng = Number(best.lon);
      const name = (best.display_name?.split(",")[0] as string | undefined) || q;
      const bbox = best.boundingbox ? parseNominatimBBox(best.boundingbox) : undefined;
      const polygon = best.geojson ? normaliseGeoJSON(best.geojson) : undefined;

      const p: AreaPayload = {
        found: true,
        lat,
        lng,
        name,
        source: "nominatim",
        ...(bbox ? { bbox } : {}),
        ...(polygon ? { polygon } : {}),
      };
      return NextResponse.json(p, {
        headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=86400" },
      });
    }

    // 2) Overpass fallback for a relation (centroid + bbox)
    const over = await overpassAreaByName(q);
    const rel = (over.elements ?? []).find((e) => e.type === "relation");
    if (rel) {
      const name =
        (rel.tags && (rel.tags.name || rel.tags["name:en"] || rel.tags["name:af"])) || q;

      // Prefer bounds if present; otherwise approximate from center
      let bbox: BBox | undefined;
      if (rel.bounds) {
        bbox = [rel.bounds.minlat, rel.bounds.minlon, rel.bounds.maxlat, rel.bounds.maxlon];
      }

      let lat = Number.isFinite(nearLat) ? nearLat : 0;
      let lng = Number.isFinite(nearLng) ? nearLng : 0;

      if (rel.center) {
        lat = rel.center.lat;
        lng = rel.center.lon;
      } else if (bbox) {
        const c = toCentroidFromBBox(bbox);
        lat = c.lat;
        lng = c.lng;
      }

      const p: AreaPayload = {
        found: true,
        lat,
        lng,
        name,
        source: "overpass",
        ...(bbox ? { bbox } : {}),
      };
      return NextResponse.json(p, {
        headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=86400" },
      });
    }

    const p: AreaPayload = { found: false, error: "Area not found" };
    return NextResponse.json(p, { status: 404 });
  } catch (err) {
    const p: AreaPayload = {
      found: false,
      error: "Area lookup failed",
      detail: String(err),
    };
    return NextResponse.json(p, { status: 502 });
  }
}
