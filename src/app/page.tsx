"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import MapClient from "@/components/MapClient";
import TopSearch from "@/components/TopSearch";
import CategoryAside from "@/components/CategoryAside";
import {MobileResultsSheet} from "@/components/MobileResultsSheet";

import useStore from "@/lib/useStore";

type TopSearchSubmitDetail = { query: string };
type GeoJSONPoly =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
type GeocodeResponse = {
  found: boolean;
  lat: number;
  lng: number;
  name?: string;
  bbox?: [number, number, number, number];
  polygon?: GeoJSONPoly;
};

export default function HomePage() {
  const searchParams = useSearchParams();

  const initial = useMemo<[number, number]>(() => {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [lat, lng]
      : [-26.2041, 28.0473]; // Johannesburg fallback
  }, [searchParams]);

  const center = useStore((s) => s.center);
  const setCenter = useStore((s) => s.setCenter);
  const setQuery = useStore((s) => s.setQuery);

  useEffect(() => {
    function handleSearch(e: Event) {
      const ce = e as CustomEvent<TopSearchSubmitDetail>;
      const q = (ce.detail?.query ?? "").trim();
      if (!q) return;

      setQuery(q);

      (async () => {
        try {
          const params = new URLSearchParams({
            q,
            nearLat: String(center?.[0] ?? initial[0]),
            nearLng: String(center?.[1] ?? initial[1]),
            radiusKm: "30",
          });

          const res = await fetch(`/api/geocode?${params.toString()}`);
          if (!res.ok) return;

          const data = (await res.json()) as GeocodeResponse;

          setCenter([data.lat, data.lng]);

          let bbox = data.bbox;
          if (!bbox) {
            const d = 0.01;
            bbox = [data.lat - d, data.lng - d, data.lat + d, data.lng + d];
          }

          window.dispatchEvent(
            new CustomEvent("map:area", {
              detail: {
                name: data.name ?? q,
                bbox,
                polygon: data.polygon,
              },
            })
          );
        } catch {
          // Silent failure
        }
      })();
    }

    window.addEventListener("topsearch:submit", handleSearch as EventListener);
    return () =>
      window.removeEventListener(
        "topsearch:submit",
        handleSearch as EventListener
      );
  }, [center, initial, setCenter, setQuery]);

  return (
    <main className="min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-[1200] border-b border-muted bg-[--bg] py-4">
        <div className="h-full flex items-center justify-center">
          <h1 className="flex items-center gap-2 text-3xl md:text-5xl font-bold leading-none">
            <span>Local</span>
            <Logo className="h-[3.5rem] w-auto text-[rgb(var(--accent))]" />
            <span>Finder</span>
          </h1>
        </div>
      </header>

      {/* Search bar */}
      <TopSearch />

      {/* Responsive layout: flex on mobile, grid on desktop */}
      <div className="flex flex-col md:grid md:grid-cols-[18rem_1fr] md:gap-0 border-t">
        {/* Category aside */}
        <div className="order-1 md:order-none md:border-r">
          <CategoryAside />
        </div>

        {/* Mobile-only results panel */}
        <div className="block md:hidden order-2">
          {/* <MobileResultsSheet /> */}
        </div>

        {/* Map section */}
        <section
          className={[
            // Mobile height accounts for header + search + results
            "relative order-3 md:order-none",
            "h-[calc(100dvh-56px-48px-240px)]",
            "md:h-[calc(100dvh-56px-48px)]",
          ].join(" ")}
        >
          <Suspense fallback={<div className="h-full w-full" />}>
            <MapClient center={initial} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
