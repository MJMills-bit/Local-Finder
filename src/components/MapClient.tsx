// src/components/ui/MapClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import useStore, { type Place } from "@/lib/useStore";

// Render map on client only
const MapView = dynamic(() => import("./MapView"), { ssr: false });

/** Zoom -> radius helper (meters) */
function radiusForZoom(z: number) {
  const table: Record<number, number> = {
    18: 250,
    17: 350,
    16: 600,
    15: 900,
    14: 1200,
    13: 1800,
    12: 3000,
  };
  const nearest = Math.max(12, Math.min(18, Math.round(z)));
  return table[nearest] ?? 1200;
}

/** Normalize numbers to reduce micro-churn in request keys */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** True if a place matches a textual query */
function matchesQuery(p: Place, qLower: string): boolean {
  const hay = [
    p.name,
    p.tags?.name,
    p.tags?.brand,
    p.tags?.operator,
    p.tags?.amenity,
    p.tags?.shop,
    p.tags?.addr_full,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qLower);
}

type Props = { center?: [number, number] };

/* ---------- Global dedupe guards ---------- */
const IN_FLIGHT = new Map<string, Promise<Place[] | null>>();
const RECENTLY_SERVED = new Map<string, number>(); // key -> ts

/* ---------- Minimal type for window.__leafletMap to avoid `any` ---------- */
type FlyMap = {
  flyTo: (
    latlng: [number, number],
    zoom?: number,
    options?: { animate?: boolean; duration?: number }
  ) => void;
};

export default function MapClient({ center }: Props) {
  const rawCenter = useStore((s) => s.center);
  const setCenter = useStore((s) => s.setCenter);
  const category = useStore((s) => s.category);
  const zoom = useStore((s) => s.view.zoom ?? 14);
  const radiusStore = useStore((s) => s.radius);
  const setPlaces = useStore((s) => s.setPlaces);
  const query = useStore((s) => s.query);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);

  // NEW: global loading & error for spinner + toasts in aside
  const setGlobalLoading = useStore((s) => s.setLoading);
  const setGlobalError = useStore((s) => s.setError);

  /* ---------- geolocation-related hooks ---------- */
  const setUserLocation = useStore((s) => s.setUserLocation);
  const setZoom = useStore((s) => s.setZoom);
  const [showLocate, setShowLocate] = useState<boolean>(true);
  const [locating, setLocating] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Initialize once
  useEffect(() => {
    if (center) setCenter(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const radius = radiusStore || radiusForZoom(zoom);
  const c = rawCenter;

  /** Stable request key (normalized) */
  const key = useMemo(() => {
    if (!c) return "";
    const lat = round6(c[0]).toFixed(6);
    const lng = round6(c[1]).toFixed(6);
    const r = String(Math.max(50, Math.floor(radius)));
    const cat = category ?? "all";
    const q = (query ?? "").trim().toLowerCase();
    return `${lat}|${lng}|${r}|${cat}|${q}`;
  }, [c, radius, category, query]);

  // local toast state (kept for your UI)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Local book-keeping */
  const cacheRef = useRef<Map<string, { ts: number; data: Place[] }>>(new Map());
  const lastSatisfiedKeyRef = useRef<string>("");
  const lastHandledQueryRef = useRef<string>(""); // avoid re-selecting on each refetch
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  // NEW: ensure spinner is always visible for at least X ms
  const MIN_SPINNER_MS = 250;
  const spinStartRef = useRef<number>(0);

  useEffect(() => {
    if (!key || !c) return;
    if (key === lastSatisfiedKeyRef.current) return;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(async () => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const now = Date.now();
      const TTL = 2 * 60 * 1000;
      const SWR_GAP = 30 * 1000;
      const RECENT_WINDOW = 5 * 1000;

      const cached = cacheRef.current.get(key);
      const queryLower = (query ?? "").trim().toLowerCase();
      const hasQuery = queryLower.length >= 2;

      // ---- START SPINNER (global + local) for every path ----
      spinStartRef.current = performance.now();
      setGlobalLoading(true);
      setLoading(true);
      setError(null);
      setGlobalError(null);

      // --- helper: ensure min spinner visibility before turning off
      const stopSpinner = () => {
        const elapsed = performance.now() - spinStartRef.current;
        const delay = Math.max(0, MIN_SPINNER_MS - elapsed);
        window.setTimeout(() => {
          setLoading(false);
          setGlobalLoading(false);
        }, delay);
      };

      // --- helper: deduped fetch with explicit radius ---
      const fetchWithRadius = async (radiusM: number): Promise<Place[] | null> => {
        const requestKey = `${key}::r=${radiusM}`;
        const lastServed = RECENTLY_SERVED.get(requestKey) ?? 0;
        if (now - lastServed < RECENT_WINDOW && cached) return cached.data;

        const existing = IN_FLIGHT.get(requestKey);
        if (existing) return existing;

        const [lat, lng] = c;
        const params = new URLSearchParams({
          lat: round6(lat).toString(),
          lng: round6(lng).toString(),
          radius: String(Math.max(50, Math.floor(radiusM))),
          category: category ?? "all",
        });
        if (hasQuery) params.set("q", queryLower);

        const promise = (async () => {
          const res = await fetch(`/api/overpass?${params.toString()}`, {
            signal: ctrl.signal,
            cache: "no-store",
          });
          if (!res.ok) return null;
          const json = (await res.json()) as Place[] | { data?: Place[] };
          return Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
        })();

        IN_FLIGHT.set(requestKey, promise);
        try {
          const list = await promise;
          return list;
        } finally {
          IN_FLIGHT.delete(requestKey);
        }
      };

      try {
        // Serve warm cache immediately (spinner still shows briefly)
        if (cached && now - cached.ts < TTL) {
          const data = hasQuery ? cached.data.filter((p) => matchesQuery(p, queryLower)) : cached.data;
          setPlaces(data);
          lastSatisfiedKeyRef.current = key;

          if (hasQuery && lastHandledQueryRef.current !== queryLower && data.length > 0) {
            setSelectedPlace(data[0]);
            lastHandledQueryRef.current = queryLower;
          }

          const lastCheck = cacheRef.current.get(`rev:${key}`)?.ts ?? 0;
          if (now - lastCheck >= SWR_GAP) {
            cacheRef.current.set(`rev:${key}`, { ts: now, data: [] });
            // fire-and-forget revalidation; spinner will already stop after min delay
            (async () => {
              try {
                const baseR = Math.max(radius, hasQuery ? 6000 : radius);
                let fresh = await fetchWithRadius(baseR);
                if (hasQuery && (fresh?.filter((p) => matchesQuery(p, queryLower)).length ?? 0) < 5) {
                  const bigger = Math.min(baseR * 2, 12000);
                  const more = await fetchWithRadius(bigger);
                  if (more) {
                    const mapById = new Map<string, Place>();
                    [...(fresh ?? []), ...more].forEach((p) => mapById.set(p.id, p));
                    fresh = Array.from(mapById.values());
                  }
                }
                if (fresh) {
                  cacheRef.current.set(key, { ts: Date.now(), data: fresh });
                  const filtered = hasQuery ? fresh.filter((p) => matchesQuery(p, queryLower)) : fresh;
                  setPlaces(filtered);
                  RECENTLY_SERVED.set(`${key}::r=${Math.max(radius, hasQuery ? 6000 : radius)}`, Date.now());
                  lastSatisfiedKeyRef.current = key;

                  if (hasQuery && lastHandledQueryRef.current !== queryLower && filtered.length > 0) {
                    setSelectedPlace(filtered[0]);
                    lastHandledQueryRef.current = queryLower;
                  }
                }
              } catch {
                /* ignore */
              }
            })();
          }

          stopSpinner();
          return;
        }

        // Network path (widen search during query)
        const baseR = Math.max(radius, hasQuery ? 6000 : radius);
        let data = await fetchWithRadius(baseR);

        // If few matches, try one wider pass and merge
        if (hasQuery && (data?.filter((p) => matchesQuery(p, queryLower)).length ?? 0) < 5) {
          const bigger = Math.min(baseR * 2, 12000);
          const more = await fetchWithRadius(bigger);
          if (more) {
            const mapById = new Map<string, Place>();
            [...(data ?? []), ...more].forEach((p) => mapById.set(p.id, p));
            data = Array.from(mapById.values());
          }
        }

        if (data) {
          cacheRef.current.set(key, { ts: Date.now(), data });
          const filtered = hasQuery ? data.filter((p) => matchesQuery(p, queryLower)) : data;

          setPlaces(filtered);
          RECENTLY_SERVED.set(`${key}::r=${baseR}`, Date.now());
          lastSatisfiedKeyRef.current = key;

          if (hasQuery && lastHandledQueryRef.current !== queryLower && filtered.length > 0) {
            setSelectedPlace(filtered[0]);
            lastHandledQueryRef.current = queryLower;
          }
        }

        stopSpinner();
      } catch (err) {
        if (!ctrl.signal.aborted) {
          const msg = err instanceof Error ? err.message : "Failed to load places";
          setError(msg);
          setGlobalError(msg);
          // still stop spinner with min delay
          const elapsed = performance.now() - spinStartRef.current;
          const delay = Math.max(0, MIN_SPINNER_MS - elapsed);
          window.setTimeout(() => {
            setLoading(false);
            setGlobalLoading(false);
          }, delay);
        }
      }
    }, 350) as unknown as number;

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, c, radius, category, query, setPlaces, setSelectedPlace, setGlobalLoading, setGlobalError]);

  /* ---------- locate handler ---------- */
  function handleLocate(): void {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;

        // set user pin + view
        setUserLocation({ lat: latitude, lng: longitude });
        setCenter([latitude, longitude]);
        setZoom(18);

        // smooth fly if map is exposed
        const m = (window as unknown as { __leafletMap?: FlyMap }).__leafletMap;
        if (m) m.flyTo([latitude, longitude], 18, { animate: true, duration: 0.8 });

        setShowLocate(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(err.message || "Could not get your position.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  const Toasts = () => (
    <>
      {loading && (
        <div className="pointer-events-none fixed right-3 top-[calc(56px+6px)] z-[1100] rounded-md border bg-white/90 px-3 py-1 text-xs shadow">
          loading places…
        </div>
      )}
      {error && (
        <div className="fixed right-3 top-[calc(56px+36px)] z-[1100] max-w-[320px] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
          {error}
          <button
            className="ml-3 inline-flex rounded border border-red-300 bg-white/70 px-2 py-[2px] text-xs hover:bg-white"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}
      {/* locate errors */}
      {geoError && (
        <div className="fixed right-3 top-[calc(56px+60px)] z-[1100] max-w-[320px] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
          {geoError}
          <button
            className="ml-3 inline-flex rounded border border-red-300 bg-white/70 px-2 py-[2px] text-xs hover:bg-white"
            onClick={() => setGeoError(null)}
          >
            dismiss
          </button>
        </div>
      )}
    </>
  );

  if (!c) {
    return (
      <div className="relative h-full w-full">
        <div className="p-3 text-sm text-neutral-500">Loading map…</div>
        <Toasts />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapView center={c} />

      {/* “Press to locate” overlay */}
      {showLocate && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="pointer-events-auto rounded-2xl border bg-white/90 px-5 py-3 text-base font-medium shadow-sm hover:bg-white focus:outline-none focus:ring-4 ring-[rgb(var(--ring))/0.3]"
            aria-label="Press to locate your position"
          >
            {locating ? "Locating…" : "Press to locate"}
          </button>
        </div>
      )}

      <Toasts />
    </div>
  );
}
