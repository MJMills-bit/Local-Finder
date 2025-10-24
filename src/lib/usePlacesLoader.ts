// src/lib/usePlacesLoader.ts
import { useEffect, useRef, useState } from "react";
import useStore from "@/lib/useStore";
import type { Place } from "@/lib/types";

/** Debounce a value (not a ref) so deps are correct */
function useDebouncedValue<T>(value: T, delay = 250): T {
  const [v, setV] = useState<T>(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Basic text match helper (same logic as elsewhere) */
function matchesQuery(p: Place, qLower: string): boolean {
  const hay = [
    p.name,
    p.tags?.name,
    p.tags?.brand,
    p.tags?.operator,
    p.tags?.amenity,
    p.tags?.shop,
    p.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qLower);
}

// global request guards (per tab)
const IN_FLIGHT = new Map<string, Promise<Place[] | null>>();
const RECENTLY_SERVED = new Map<string, number>(); // key -> ts

export default function usePlacesLoader() {
  const category     = useStore((s) => s.category);
  const radius       = useStore((s) => s.radius);
  const center       = useStore((s) => s.center);          // CenterTuple | undefined
  const query        = useStore((s) => s.query);

  const setPlaces    = useStore((s) => s.setPlaces);
  const setLoading   = useStore((s) => s.setLoading);
  const setError     = useStore((s) => s.setError);

  const debouncedRadius = useDebouncedValue(radius, 250);

  // local cache (warm + SWR)
  const cacheRef = useRef<Map<string, { ts: number; data: Place[] }>>(new Map());
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!center) return; // nothing to fetch yet
    const [lat, lng] = center; // ✅ tuple, not object

    const qLower = (query ?? "").trim().toLowerCase();
    const hasQuery = qLower.length >= 2;

    // stable key (tuple + filters)
    const key = [
      lat.toFixed(6),
      lng.toFixed(6),
      String(Math.max(50, Math.floor(debouncedRadius))),
      category ?? "all",
      qLower,
    ].join("|");

    // abort previous
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const id = ++reqIdRef.current;
    const now = Date.now();

    const TTL = 2 * 60 * 1000;
    const SWR_GAP = 30 * 1000;
    const RECENT_WINDOW = 5 * 1000;

    // start spinner (always)
    const spinStart = performance.now();
    const MIN_SPINNER_MS = 250;
    setLoading(true);
    setError(null);

    const stopSpinner = () => {
      const elapsed = performance.now() - spinStart;
      const delay = Math.max(0, MIN_SPINNER_MS - elapsed);
      window.setTimeout(() => {
        if (id === reqIdRef.current) setLoading(false);
      }, delay);
    };

    const fetchDedupe = async (r: number): Promise<Place[] | null> => {
      const reqKey = `${key}::r=${r}`;
      const last = RECENTLY_SERVED.get(reqKey) ?? 0;
      const cached = cacheRef.current.get(key);

      if (now - last < RECENT_WINDOW && cached) return cached.data;

      const inFlight = IN_FLIGHT.get(reqKey);
      if (inFlight) return inFlight;

      const url = `/api/overpass?lat=${lat}&lng=${lng}&radius=${Math.max(50, Math.floor(r))}&category=${encodeURIComponent(category ?? "all")}${hasQuery ? `&q=${encodeURIComponent(qLower)}` : ""}`;

      const promise = (async () => {
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) return null;
        const json = (await res.json()) as Place[] | { data?: Place[]; results?: Place[] };
        if (Array.isArray(json)) return json;
        if (Array.isArray(json?.data)) return json.data;
        if (Array.isArray(json?.results)) return json.results;
        return [];
      })();

      IN_FLIGHT.set(reqKey, promise);
      try {
        return await promise;
      } finally {
        IN_FLIGHT.delete(reqKey);
      }
    };

    // serve warm cache immediately (still show spinner briefly)
    const warm = cacheRef.current.get(key);
    if (warm && now - warm.ts < TTL) {
      const data = hasQuery ? warm.data.filter((p) => matchesQuery(p, qLower)) : warm.data;
      if (id === reqIdRef.current) setPlaces(data);

      // background revalidate if stale-while-revalidate gap passed
      const lastRev = cacheRef.current.get(`rev:${key}`)?.ts ?? 0;
      if (now - lastRev >= SWR_GAP) {
        cacheRef.current.set(`rev:${key}`, { ts: now, data: [] });
        (async () => {
          try {
            const baseR = Math.max(debouncedRadius, hasQuery ? 6000 : debouncedRadius);
            let fresh = await fetchDedupe(baseR);
            if (hasQuery && (fresh?.filter((p) => matchesQuery(p, qLower)).length ?? 0) < 5) {
              const bigger = Math.min(baseR * 2, 12000);
              const more = await fetchDedupe(bigger);
              if (more) {
                const map = new Map<string, Place>();
                [...(fresh ?? []), ...more].forEach((p) => map.set(p.id, p));
                fresh = Array.from(map.values());
              }
            }
            if (fresh && id === reqIdRef.current) {
              cacheRef.current.set(key, { ts: Date.now(), data: fresh });
              const filtered = hasQuery ? fresh.filter((p) => matchesQuery(p, qLower)) : fresh;
              setPlaces(filtered);
              RECENTLY_SERVED.set(`${key}::r=${Math.max(debouncedRadius, hasQuery ? 6000 : debouncedRadius)}`, Date.now());
            }
          } catch {
            /* swallow bg errors */
          }
        })();
      }

      stopSpinner();
      return () => ctrl.abort();
    }

    // network path
    (async () => {
      try {
        const baseR = Math.max(debouncedRadius, hasQuery ? 6000 : debouncedRadius);
        let data = await fetchDedupe(baseR);

        if (hasQuery && (data?.filter((p) => matchesQuery(p, qLower)).length ?? 0) < 5) {
          const bigger = Math.min(baseR * 2, 12000);
          const more = await fetchDedupe(bigger);
          if (more) {
            const map = new Map<string, Place>();
            [...(data ?? []), ...more].forEach((p) => map.set(p.id, p));
            data = Array.from(map.values());
          }
        }

        if (data && id === reqIdRef.current) {
          cacheRef.current.set(key, { ts: Date.now(), data });
          const filtered = hasQuery ? data.filter((p) => matchesQuery(p, qLower)) : data;
          setPlaces(filtered);
          RECENTLY_SERVED.set(`${key}::r=${baseR}`, Date.now());
        }
      } catch (e) {
        if (!ctrl.signal.aborted && id === reqIdRef.current) {
          setError(e instanceof Error ? e.message : "Failed to load places");
        }
      } finally {
        stopSpinner();
      }
    })();

    return () => ctrl.abort();
    // ✅ correct deps: value versions, not refs
  }, [category, debouncedRadius, center?.[0], center?.[1], query, setError, setLoading, setPlaces]);
}
