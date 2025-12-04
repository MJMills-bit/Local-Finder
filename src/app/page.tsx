"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import MapClient from "@/components/MapClient";
import TopSearch from "@/components/TopSearch";
import CategoryAside from "@/components/CategoryAside";
import RadiusControl from "@/components/RadiusControl";
import useStore from "@/lib/useStore";

type TopSearchSubmitDetail = { query: string };

type GeoJSONPoly =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type GeocodeResponse =
  | {
      found: true;
      lat: number;
      lng: number;
      name?: string;
      bbox?: [number, number, number, number];
      polygon?: GeoJSONPoly;
    }
  | { found: false; error?: string };

function SearchParamsWrapper({
  children,
}: {
  children: (initial: [number, number]) => React.ReactNode;
}) {
  const searchParams = useSearchParams();

  const initial = useMemo<[number, number]>(() => {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? [lat, lng]
      : [-26.2041, 28.0473];
  }, [searchParams]);

  return <>{children(initial)}</>;
}

export default function HomePage() {
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
            nearLat: String(center?.[0] ?? -26.2041),
            nearLng: String(center?.[1] ?? 28.0473),
            radiusKm: "30",
          });
          const res = await fetch(`/api/geocode?${params.toString()}`, {
            cache: "no-store",
          });
          if (!res.ok) return;

          const data = (await res.json()) as GeocodeResponse;
          if (!("found" in data) || !data.found) return;

          setCenter([data.lat, data.lng]);

          const bbox =
            data.bbox ??
            ([data.lat - 0.01, data.lng - 0.01, data.lat + 0.01, data.lng + 0.01] as [
              number,
              number,
              number,
              number
            ]);

          window.dispatchEvent(
            new CustomEvent("map:area", {
              detail: { name: data.name ?? q, bbox, polygon: data.polygon },
            })
          );
        } catch {
          // silent fail
        }
      })();
    }

    window.addEventListener("topsearch:submit", handleSearch as EventListener);
    return () =>
      window.removeEventListener("topsearch:submit", handleSearch as EventListener);
  }, [center, setCenter, setQuery]);

  return (
    <main className="h-dvh bg-[--bg] flex flex-col">
      {/* Fixed Header */}
      <header className="sticky top-0 z-[1200] border-b border-muted bg-[--bg] py-4">
        <div className="h-full flex items-center justify-center">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl md:text-5xl font-bold leading-none">
            <span>Local</span>
            <Logo className="h-[2.25rem] sm:h-[3rem] md:h-[3.5rem] w-auto text-[rgb(var(--accent))]" />
            <span>Finder</span>
          </h1>
        </div>
      </header>

      {/* Sticky Search Bar */}
      <TopSearch />

      {/* Main Layout */}
      <div className="flex-1 min-h-0 md:grid md:grid-cols-[18rem_1fr] border-t">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-[100svh] md:overflow-y-auto md:border-r bg-white/90 backdrop-blur">
          <div className="p-3 border-b bg-white/95">
            <RadiusControl />
          </div>
          <div className="flex-1 overflow-y-auto">
            <CategoryAside />
          </div>
        </aside>

        {/* Mobile + Map Layout */}
        <section className="flex flex-col h-full min-h-0">
          <div className="md:hidden flex flex-col px-3 pt-2 max-h-[50svh] overflow-y-auto gap-3">
            <div className="rounded-xl border bg-white/95 shadow-sm p-3">
              <RadiusControl />
            </div>
            <div className="rounded-xl border bg-white/95 shadow-sm p-3">
              <CategoryAside />
            </div>
          </div>

          <div className="flex-1 min-h-[50svh] relative">
            <Suspense fallback={<div className="h-full w-full" />}>
              <SearchParamsWrapper>
                {(initial) => <MapClient center={initial} />}
              </SearchParamsWrapper>
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
