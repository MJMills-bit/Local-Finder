// src/components/RadiusControl.tsx
"use client";

import { useId, useState, useEffect } from "react";
import useStore from "@/lib/useStore";

function hasCenter(c: unknown): c is [number, number] {
  return (
    Array.isArray(c) &&
    c.length === 2 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1])
  );
}

// Radius config: 3 km → 30 km in 3 km steps
const MIN_KM = 3;
const MAX_KM = 30;
const STEP_KM = 3;

const MIN_METERS = MIN_KM * 1000; // 3000
const MAX_METERS = MAX_KM * 1000; // 30000
const STEP_METERS = STEP_KM * 1000; // 3000

export default function RadiusControl() {
  const center = useStore((s) => s.center);
  const query = useStore((s) => s.query);
  const radiusFromStore = useStore((s) => s.radius);
  const setRadius = useStore((s) => s.setRadius);
  const placesCount = useStore((s) => s.places.length);
  const loading = useStore((s) => s.loading);

  const rangeId = useId();

  // Default label radius: 3 km if nothing in store yet
  const radius = radiusFromStore ?? MIN_METERS;
  const kmLabel = (radius / 1000).toFixed(0);
  const qActive = (query ?? "").trim().length > 0;

  // Local state to debounce slider changes
  const [tempRadius, setTempRadius] = useState<number>(radius);

  // Track whether the user has actually touched the slider
  const [hasInteracted, setHasInteracted] = useState(false);

  // Sync local state if radiusFromStore changes externally
  useEffect(() => {
    if (radiusFromStore != null) {
      setTempRadius(radiusFromStore);
    }
  }, [radiusFromStore]);

  // Debounce updates to the global radius (500 ms delay),
  // but only after the user has moved the slider at least once.
  useEffect(() => {
    if (!hasInteracted) return;

    const handler = setTimeout(() => {
      setRadius(tempRadius);
    }, 500);

    return () => clearTimeout(handler);
  }, [tempRadius, hasInteracted, setRadius]);

  // No center yet: show disabled control
  if (!hasCenter(center)) {
    return (
      <div className="mt-4 rounded-lg border p-3 opacity-60 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between">
          <label htmlFor={rangeId} className="font-medium">
            Search radius
          </label>
          <span className="text-sm text-gray-600">{kmLabel} km</span>
        </div>
        <input
          id={rangeId}
          type="range"
          min={MIN_METERS}
          max={MAX_METERS}
          step={STEP_METERS}
          value={radius}
          disabled
          readOnly
          className="mt-2 w-full"
          aria-label="Search radius (disabled until location is set)"
          title="Search radius"
        />
        <div className="mt-1 text-xs text-gray-600">
          Set your location to adjust radius
        </div>
      </div>
    );
  }

  // Center is available: active slider with debounced updates
  return (
    <div className="mt-4 rounded-lg border p-3 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between">
        <label htmlFor={rangeId} className="font-medium">
          Search radius
        </label>
        <span className="text-sm text-gray-600">
          {(tempRadius / 1000).toFixed(0)} km
        </span>
      </div>

      <input
        id={rangeId}
        type="range"
        min={MIN_METERS}
        max={MAX_METERS}
        step={STEP_METERS}
        value={tempRadius}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) {
            setHasInteracted(true);
            setTempRadius(next);
          }
        }}
        className="mt-2 w-full accent-[rgb(var(--accent))]"
        aria-label="Search radius"
        title="Search radius"
      />

      <div className="mt-1 text-xs text-gray-600">
        {loading
          ? "Updating…"
          : placesCount === 0
          ? "No places found in this radius"
          : `Showing ${placesCount} place${placesCount === 1 ? "" : "s"}`}
        {qActive && (
          <span className="ml-2 text-[11px] text-neutral-500">
            (search active)
          </span>
        )}
      </div>
    </div>
  );
}
