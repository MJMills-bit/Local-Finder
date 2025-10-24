// src/components/RadiusControl.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "@/lib/useStore";

type S = ReturnType<typeof useStore.getState>;
type Place = S["places"][number];

function hasCenter(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
}

export default function RadiusControl() {
  const center = useStore((s) => s.center);
  const category = useStore((s) => s.category);
  const setPlaces = useStore((s) => s.setPlaces);
  const query = useStore((s) => s.query); // lock while searching

  // Default radius: 3000 m (3 km)
  const [radius, setRadius] = useState(3000);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  // Debounced fetch when radius/category/center changes and no active query
  useEffect(() => {
    // Don’t run until we have a valid centre or while searching
    if (!hasCenter(center) || query.trim().length > 0) return;

    // Clear any pending timer
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = window.setTimeout(async () => {
      // Cancel previous request (if any)
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setBusy(true);
      setCount(null);

      try {
        const params = new URLSearchParams({
          lat: center[0].toFixed(6),
          lng: center[1].toFixed(6),
          radius: String(Math.max(50, Math.floor(radius))),
          category,
        });

        const res = await fetch(`/api/overpass?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as Place[] | { data?: Place[] };
        const list: Place[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setPlaces(list);
        setCount(list.length);
      } catch {
        // ignore (network/abort)
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setBusy(false);
      }
    }, 250) as unknown as number;

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [radius, center, category, setPlaces, query]);

  // Abort any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Disabled UI until centre is known (satisfies TS and UX)
  if (!hasCenter(center)) {
    return (
      <div className="mt-4 rounded-lg border p-3 opacity-60">
        <div className="flex items-center justify-between">
          <span className="font-medium">Search radius</span>
          <span className="text-sm text-gray-600">{(radius / 1000).toFixed(1)} km</span>
        </div>
        <input
          type="range"
          min={300}
          max={10000}
          step={100}
          value={radius}
          disabled
          readOnly
          className="mt-2 w-full"
          aria-label="Search radius (disabled until location set)"
        />
        <div className="mt-1 text-xs text-gray-600">Set your location to adjust radius</div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">Search radius</span>
        <span className="text-sm text-gray-600">{(radius / 1000).toFixed(1)} km</span>
      </div>

      <input
        type="range"
        min={300}
        max={10000} // up to 10 km
        step={100}
        value={radius}
        onChange={(e) => setRadius(Number(e.target.value))}
        className="mt-2 w-full accent-[rgb(var(--accent))]"
        aria-label="Search radius"
      />

      <div className="mt-1 text-xs text-gray-600">
        {busy ? "Updating…" : count === null ? "—" : `Showing ${count} places`}
      </div>
    </div>
  );
}
