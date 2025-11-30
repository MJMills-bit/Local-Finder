// src/components/MapClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import useStore, { type Place } from "@/lib/useStore";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Props = {
  center?: [number, number] | null;
};

type FlyMap = {
  flyTo: (
    latlng: [number, number],
    zoom?: number,
    options?: { animate?: boolean; duration?: number }
  ) => void;
};

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
  return table[nearest];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

function matchesQuery(p: Place, qLower: string): boolean {
  if (!qLower) return true;
  const hay = [
    p.name,
    p.tags?.name,
    p.tags?.brand,
    p.tags?.operator,
    p.tags?.amenity,
    p.tags?.shop,
    p.tags?.addr_full,
    p.address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qLower);
}

function isValidLatLngTuple(
  tuple: [number, number] | undefined | null
): tuple is [number, number] {
  if (!tuple) return false;
  const [lat, lng] = tuple;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export default function MapClient({ center: centerProp }: Props) {
  const rawCenter = useStore((s) => s.center);
  const setCenter = useStore((s) => s.setCenter);
  const zoom = useStore((s) => s.view.zoom ?? 14);
  const radiusStore = useStore((s) => s.radius);
  const category = useStore((s) => s.category);
  const query = useStore((s) => s.query);
  const setPlaces = useStore((s) => s.setPlaces);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setGlobalLoading = useStore((s) => s.setLoading);
  const setGlobalError = useStore((s) => s.setError);
  const setZoom = useStore((s) => s.setZoom);
  const userLocation = useStore((s) => s.userLocation);
  const setUserLocation = useStore((s) => s.setUserLocation);

  useEffect(() => {
    if (centerProp && isValidLatLngTuple(centerProp)) {
      setCenter(centerProp);
    }
  }, [centerProp, setCenter]);

  const searchCenter = useMemo<[number, number] | null>(() => {
    if (
      userLocation &&
      isValidLatLngTuple([userLocation.lat, userLocation.lng])
    ) {
      return [userLocation.lat, userLocation.lng];
    }
    if (isValidLatLngTuple(rawCenter)) {
      return rawCenter;
    }
    return null;
  }, [userLocation, rawCenter]);

  // Use slider radius when the user has touched it, otherwise fall back to zoom.
  const effectiveRadius = useMemo(
    () => radiusStore ?? radiusForZoom(zoom),
    [radiusStore, zoom]
  );

  // Build a cache key that changes when:
  // - centre changes
  // - radius changes
  // - category changes
  // - query changes (so we refetch when user searches)
  const key = useMemo(() => {
    if (!searchCenter) return "";
    const [lat, lng] = searchCenter;
    const latStr = round6(lat).toFixed(6);
    const lngStr = round6(lng).toFixed(6);
    const r = String(Math.max(50, Math.floor(effectiveRadius)));
    const cat = category ?? "all";
    const qLower = (query ?? "").trim().toLowerCase();
    return `${latStr}|${lngStr}|${r}|${cat}|${qLower || "-"}`;
  }, [searchCenter, effectiveRadius, category, query]);

  const abortRef = useRef<AbortController | null>(null);
  const lastSatisfiedKeyRef = useRef<string>("");
  const activeKeyRef = useRef<string>("");

  const [showLocate, setShowLocate] = useState(true);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchCenter) {
      setShowLocate(false);
    }
  }, [searchCenter]);

  useEffect(() => {
    if (!searchCenter) {
      // No centre at all, clear everything.
      abortRef.current?.abort();
      setGlobalLoading(false);
      setPlaces([]);
      lastSatisfiedKeyRef.current = "";
      return;
    }

    if (!key || key === lastSatisfiedKeyRef.current) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const requestKey = key;
    activeKeyRef.current = requestKey;

    setGlobalLoading(true);
    setGlobalError(null);
    setError(null);

    const [lat, lng] = searchCenter;
    const qLower = (query ?? "").trim().toLowerCase();

    async function fetchPlaces() {
      try {
        const params = new URLSearchParams({
          lat: round6(lat).toString(),
          lng: round6(lng).toString(),
          radius: String(Math.max(50, Math.floor(effectiveRadius))),
          category: category ?? "all",
        });

        const res = await fetch(`/api/overpass?${params.toString()}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Overpass returned status ${res.status}`);
        }

        const json = (await res.json()) as Place[] | { data?: Place[] };
        const raw = Array.isArray(json)
          ? json
          : Array.isArray((json as { data?: Place[] }).data)
          ? (json as { data?: Place[] }).data!
          : [];

        const filtered = qLower
          ? raw.filter((p) => matchesQuery(p, qLower))
          : raw;

        if (activeKeyRef.current !== requestKey) return;

        setPlaces(filtered);
        lastSatisfiedKeyRef.current = requestKey;

        if (qLower && filtered.length > 0) {
          setSelectedPlace(filtered[0]);
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const msg =
          e instanceof Error ? e.message : "Failed to load places";
        setError(msg);
        setGlobalError(msg);
      } finally {
        if (activeKeyRef.current === requestKey) {
          setGlobalLoading(false);
        }
      }
    }

    fetchPlaces();

    return () => {
      ctrl.abort();
    };
  }, [
    key,
    searchCenter,
    effectiveRadius,
    category,
    query,
    setPlaces,
    setSelectedPlace,
    setGlobalLoading,
    setGlobalError,
  ]);

  async function locateViaBrowser(): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation is not available in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          reject(
            new Error(
              err.message || "Could not get your position from the browser."
            )
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }

  async function handleLocate() {
    setGeoError(null);
    setLocating(true);
    try {
      const [lat, lng] = await locateViaBrowser();
      setUserLocation({ lat, lng });
      setCenter([lat, lng]);
      setZoom(14);
      const m = (window as unknown as { __leafletMap?: FlyMap }).__leafletMap;
      if (m && typeof m.flyTo === "function") {
        m.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });
      }
    } catch (err) {
      setGeoError(
        err instanceof Error
          ? err.message
          : "Could not get your position. Please allow location and try again."
      );
    } finally {
      setLocating(false);
    }
  }

  const Toasts = () => (
    <>
      {error && (
        <div className="fixed right-3 top-4 z-[1100] max-w-[320px] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
          {error}
          <button
            className="ml-3 inline-flex rounded border border-red-300 bg-white/70 px-2 py-[2px] text-xs hover:bg-white"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}
      {geoError && (
        <div className="fixed right-3 top-16 z-[1100] max-w-[360px] rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow">
          {geoError}
          <button
            className="ml-3 inline-flex rounded border border-amber-300 bg-white/70 px-2 py-[2px] text-xs hover:bg-white"
            onClick={() => {
              setGeoError(null);
              setShowLocate(true);
            }}
          >
            try again
          </button>
        </div>
      )}
    </>
  );

  const mapInitialCenter: [number, number] = searchCenter ?? [0, 0];

  return (
    <div className="relative h-full min-h-0 w-full">
      <MapView center={mapInitialCenter} initialZoom={13} showLocate={false} />

      {showLocate && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 px-4">
          <p className="pointer-events-none mb-1 rounded-full bg-white/90 px-4 py-2 text-center text-sm md:text-base font-semibold text-[rgb(var(--accent))] shadow-sm animate-pulse">
            Unlock search by pressing “Press to locate”.
          </p>
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="pointer-events-auto rounded-2xl border bg-white/90 px-5 py-3 text-base font-medium shadow-sm hover:bg-white focus:outline-none focus:ring-4 ring-[rgb(var(--ring))/0.3]"
            aria-label="Press to locate your position"
          >
            {locating ? "Finding your area…" : "Press to locate"}
          </button>
        </div>
      )}

      <Toasts />
    </div>
  );
}
