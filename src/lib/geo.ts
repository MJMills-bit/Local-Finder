"use client";

import { useStore } from "@/lib/useStore";
import type { Map as LeafletMap } from "leaflet";

/** Optional global reference for smooth flyTo */
declare global {
  interface Window {
    __leafletMap?: LeafletMap;
  }
}

/**
 * Call from your “Press to locate” CTA.
 * - sets userLocation
 * - recenters + zooms to 18
 * - flies the map if available
 */
export async function locateMe(): Promise<void> {
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation not supported.");
    return;
  }

  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos: GeolocationPosition) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const { setUserLocation, setCenter, setZoom, setSelectedPlace } =
          useStore.getState();

        // ensure pin + view
        setUserLocation({ lat, lng });
        setCenter([lat, lng]);
        setZoom(18);

        // optional selection for aside
        setSelectedPlace({
          id: "you-are-here",
          name: "Your location",
          lat,
          lng,
          category: "all",
          address: null,
          tags: { note: "Current device location" },
        });

        // smooth fly if map available
        const map = window.__leafletMap;
        if (map) map.flyTo([lat, lng], 18, { animate: true, duration: 0.8 });

        resolve();
      },
      (err: GeolocationPositionError) => {
        console.warn("Geolocation error:", err.message);
        resolve();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
