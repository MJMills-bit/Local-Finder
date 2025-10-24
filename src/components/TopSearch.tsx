"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import useStore from "@/lib/useStore";
import type { Place } from "@/lib/types";

declare global {
  interface Window {
    __leafletMap?: import("leaflet").Map;
  }
}

type Position = [number, number];
type PolygonCoords = Position[][];
type MultiPolygonCoords = Position[][][];

type GeoJSONPolygon = { type: "Polygon"; coordinates: PolygonCoords };
type GeoJSONMultiPolygon = { type: "MultiPolygon"; coordinates: MultiPolygonCoords };

type AreaOverlay = {
  key: string;
  bbox?: [number, number, number, number];
  polygon?: GeoJSONPolygon | GeoJSONMultiPolygon | null;
};

type GeocodeResponse =
  | {
      found: true;
      lat: number;
      lng: number;
      name: string;
      source: "nominatim";
      bbox?: [number, number, number, number];
      polygon?: GeoJSONPolygon | GeoJSONMultiPolygon;
    }
  | { found: false; error: string };

export default function TopSearch() {
  const [local, setLocal] = React.useState<string>("");

  const setQuery = useStore((s) => s.setQuery);
  const center = useStore((s) => s.center); // [lat, lng]
  const setCenter = useStore((s) => s.setCenter);
  const setZoom = useStore((s) => s.setZoom);
  const places = useStore((s) => s.places);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setArea = useStore((s) => s.setArea as (area: AreaOverlay | null) => void);

  const pendingSelectionRef = React.useRef<boolean>(false);
  const lastQueryRef = React.useRef<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = local.trim();

    setQuery(text);
    lastQueryRef.current = text;
    pendingSelectionRef.current = text.length > 0;

    if (!text || !center) {
      setArea(null);
      return;
    }

    try {
      const qs = new URLSearchParams({
        q: text,
        nearLat: String(center[0]),
        nearLng: String(center[1]),
        radiusKm: "60",
      });
      const res = await fetch(`/api/geocode?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as GeocodeResponse;
      if (data.found) {
        const { lat, lng } = data;
        setCenter([lat, lng]);
        setZoom(16);
        window.__leafletMap?.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });

        const overlay: AreaOverlay = {
          key: data.name,
          bbox: data.bbox,
          polygon: data.polygon ?? null,
        };
        setArea(overlay);
      } else {
        setArea(null);
      }
    } catch {
      // silent fail
    }
  }

  React.useEffect(() => {
    if (!pendingSelectionRef.current || !places || places.length === 0) return;

    const q = lastQueryRef.current.trim().toLowerCase();
    const isMatch = (p: Place) => {
      const hay = [
        p.name,
        p.tags?.name,
        p.tags?.brand,
        p.tags?.operator,
        p.tags?.amenity,
        p.tags?.shop,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return q ? hay.includes(q) : false;
    };

    const best = places.find(isMatch) ?? places[0];
    if (best) {
      setSelectedPlace(best);
      setCenter([best.lat, best.lng]);
      setZoom(17);
      window.__leafletMap?.flyTo([best.lat, best.lng], 17, { animate: true, duration: 0.8 });
    }

    pendingSelectionRef.current = false;
  }, [places, setCenter, setZoom, setSelectedPlace]);

  function clearAll() {
    setLocal("");
    setQuery("");
    setArea(null);
    lastQueryRef.current = "";
    pendingSelectionRef.current = false;
  }

  return (
    <div className="sticky top-[56px] z-[1200] border-b border-muted bg-[--bg]/95 backdrop-blur">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-3 py-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
            size={18}
            aria-hidden
          />
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Search places (e.g., Lorraine, Walmer, cafe, Spur)…"
            className="w-full rounded-lg border bg-white/90 pl-10 pr-10 py-2 shadow outline-none focus:ring-2 ring-[rgb(var(--accent))]"
            aria-label="Search places"
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
          />
          {local && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
