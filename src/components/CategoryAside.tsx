// src/components/CategoryAside.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import useStore from "@/lib/useStore";
import type { CategoryId, Place } from "@/lib/useStore";
import type { LucideProps } from "lucide-react";
import Spinner from "./Spinner";
import {
  Coffee,
  Building2,
  Landmark,
  ChevronDown,
  ChevronRight,
  MapPin,
  Globe,
  Phone,
  Tag,
  Info,
  ArrowUpDown,
  Navigation,
} from "lucide-react";

function normalizeWebsite(url?: string): string | undefined {
  if (!url) return;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProto).toString();
  } catch {
    return;
  }
}

function hostFrom(url?: string) {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function distanceM(from: [number, number] | null, p: Place): number {
  if (!from) return Number.POSITIVE_INFINITY;
  const [lat1, lon1] = from;
  const lat2 = p.lat;
  const lon2 = p.lng;
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const sinPhi = Math.sin(dPhi / 2);
  const sinLambda = Math.sin(dLambda / 2);
  const a =
    Math.pow(sinPhi, 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.pow(sinLambda, 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function queryScore(p: Place, qLower: string): number {
  if (!qLower) return 0;
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

  const parts = qLower.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const part of parts) {
    if (hay.includes(part)) score += 1;
  }
  if (qLower && hay.includes(qLower)) score += 0.5;
  return score;
}

function directionsHref(p: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

// Safely get a comparable name string
function safeName(p: Place): string {
  return (
    p.name ??
    p.tags?.name ??
    p.tags?.brand ??
    p.tags?.operator ??
    "Unnamed place"
  );
}

type SortKey = "relevance" | "distance" | "name";

function sortPlaces(
  list: Place[],
  sortBy: SortKey,
  opts: { qLower: string; from: [number, number] | null }
): Place[] {
  const { qLower, from } = opts;
  const withMeta = list.map((p) => ({
    p,
    d: distanceM(from, p),
    s: queryScore(p, qLower),
  }));

  if (sortBy === "distance") withMeta.sort((a, b) => a.d - b.d);
  else if (sortBy === "name") {
    withMeta.sort((a, b) => safeName(a.p).localeCompare(safeName(b.p)));
  } else {
    withMeta.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      if (a.d !== b.d) return a.d - b.d;
      return safeName(a.p).localeCompare(safeName(b.p));
    });
  }

  return withMeta.map((x) => x.p);
}

const categoryConfig: Array<{
  id: CategoryId;
  label: string;
  icon?: React.ComponentType<LucideProps>;
}> = [
  { id: "all", label: "All" },
  { id: "coffee", label: "Coffee", icon: Coffee },
  { id: "coworking", label: "Coworking", icon: Building2 },
  { id: "clinic", label: "Clinics", icon: Landmark },
  { id: "restaurant", label: "Restaurants" },
  { id: "bar", label: "Bars" },
  { id: "supermarket", label: "Supermarkets" },
  { id: "pharmacy", label: "Pharmacies" },
  { id: "hotel", label: "Hotels" },
  { id: "hospital", label: "Hospitals" },
  { id: "bank", label: "Banks" },
  { id: "atm", label: "ATMs" },
  { id: "fuel", label: "Petrol" },
  { id: "park", label: "Parks" },
];

function SelectedPlaceSummary() {
  const p = useStore((s) => s.selectedPlace);
  if (!p) return null;

  const website = normalizeWebsite(p.tags?.website);
  const websiteHost = hostFrom(website);
  const phone = p.tags?.phone;
  const address = p.address;

  return (
    <div className="rounded-xl border p-3 shadow-sm bg-white space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold leading-tight">
          {p.name ?? "Unnamed place"}
        </div>
        {p.tags?.amenity ? (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
            {p.tags.amenity}
          </span>
        ) : null}
      </div>

      {address ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="mt-[2px] text-neutral-500">
            <MapPin size={16} />
          </span>
          <span className="text-neutral-800 break-words">{address}</span>
        </div>
      ) : null}

      {website ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="mt-[2px] text-neutral-500">
            <Globe size={16} />
          </span>
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgb(var(--accent))] underline decoration-1 underline-offset-2 break-all"
          >
            {websiteHost ?? website}
          </a>
        </div>
      ) : null}

      {phone ? (
        <div className="flex items-start gap-2 text-sm">
          <span className="mt-[2px] text-neutral-500">
            <Phone size={16} />
          </span>
          <a href={`tel:${phone}`} className="hover:underline">
            {phone}
          </a>
        </div>
      ) : null}

      {(() => {
        const tags: string[] = [];
        const tt = p.tags ?? {};
        if (tt.cuisine) tags.push(String(tt.cuisine));
        if (tt.wheelchair) tags.push(`wheelchair: ${tt.wheelchair}`);
        if (tt.internet_access) tags.push(`wifi: ${tt.internet_access}`);
        if (tt.opening_hours) tags.push(`hours: ${tt.opening_hours}`);
        return tags.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((x) => (
              <span
                key={x}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-neutral-700"
              >
                <Tag size={12} />
                {x}
              </span>
            ))}
          </div>
        ) : null;
      })()}

      <div className="pt-2">
        <a
          href={directionsHref(p)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          title="Open directions"
        >
          Directions →
        </a>
      </div>

      {!address && !website && !phone && !p.tags?.amenity ? (
        <div className="flex items-start gap-2 text-xs text-neutral-500">
          <Info size={14} className="mt-[2px]" />
          <span>Limited details on OpenStreetMap for this place.</span>
        </div>
      ) : null}
    </div>
  );
}

export default function CategoryAside() {
  const category = useStore((s) => s.category);
  const setCategory = useStore((s) => s.setCategory);
  const places = useStore((s) => s.places);
  const query = useStore((s) => s.query);
  const center = useStore((s) => s.center);
  const userLocation = useStore((s) => s.userLocation);
  const selectedPlace = useStore((s) => s.selectedPlace);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setLockOnSelection = useStore((s) => s.setLockOnSelection);
  const setCenter = useStore((s) => s.setCenter);
  const setZoom = useStore((s) => s.setZoom);
  const globalLoading = useStore((s) => s.loading);

  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [catsOpen, setCatsOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [showMoreCats, setShowMoreCats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingCategory, setPendingCategory] =
    useState<CategoryId | null>(null);
  const [loadingSince, setLoadingSince] = useState<number | null>(null);
  const MIN_SPINNER_MS = 250;

  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop) {
        setCatsOpen(true);
        setSortOpen(true);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { primary: primaryCats, extra: extraCats } = useMemo(() => {
    const primaryIds: CategoryId[] = [
      "all",
      "coffee",
      "coworking",
      "clinic",
      "restaurant",
      "bar",
      "supermarket",
      "pharmacy",
    ];
    return {
      primary: categoryConfig.filter((c) => primaryIds.includes(c.id)),
      extra: categoryConfig.filter((c) => !primaryIds.includes(c.id)),
    };
  }, []);

  const filteredSorted: Place[] = useMemo(() => {
    const base =
      category === "all" ? places : places.filter((p) => p.category === category);
    const qLower = query.trim().toLowerCase();
    const filtered = qLower ? base.filter((p) => queryScore(p, qLower) > 0) : base;

    const from: [number, number] | null = userLocation
      ? [userLocation.lat, userLocation.lng]
      : center ?? null;

    return sortPlaces(filtered, sortBy, { qLower, from });
  }, [places, category, query, sortBy, userLocation, center]);

  useEffect(() => {
    if (!loading || pendingCategory === null) return;
    if (category !== pendingCategory) return;
    const now = performance.now();
    const elapsed = loadingSince ? now - loadingSince : MIN_SPINNER_MS;
    const delay = Math.max(0, MIN_SPINNER_MS - elapsed);
    const t = setTimeout(() => {
      setLoading(false);
      setPendingCategory(null);
      setLoadingSince(null);
    }, delay);
    return () => clearTimeout(t);
  }, [filteredSorted, category, pendingCategory, loading, loadingSince]);

  useEffect(() => {
    if (!selectedPlace) return;
    if (!filteredSorted.some((p) => p.id === selectedPlace.id)) {
      setSelectedPlace(null);
    }
  }, [filteredSorted, selectedPlace, setSelectedPlace]);

  const origin: [number, number] | null = userLocation
    ? [userLocation.lat, userLocation.lng]
    : center ?? null;

  const handleCategoryClick = (c: CategoryId) => {
    setPendingCategory(c);
    setLoading(true);
    setLoadingSince(performance.now());
    setCategory(c);
    setShowMoreCats(false);
    setCatsOpen(false);
  };

  const hasCentre =
    Array.isArray(center) &&
    center.length === 2 &&
    Number.isFinite(center[0]) &&
    Number.isFinite(center[1]);

  const resultsListEmptyMessage = hasCentre
    ? "No places. Try a different category or search."
    : "Set your location first, then we will list places here.";

  return (
    <aside className="w-full">
      <div className="px-3 py-3 space-y-4">
        {/* Categories */}
        <section aria-labelledby="categories-heading" className="rounded-md">
          <div className="mb-2 flex items-center justify-between">
            <div id="categories-heading" className="text-sm font-medium">
              Categories
            </div>
            <button
              type="button"
              onClick={() => setCatsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--accent))]"
              aria-expanded={catsOpen ? "true" : "false"}
              aria-controls="categories-panel"
            >
              {catsOpen ? (
                <>
                  <ChevronDown size={14} aria-hidden="true" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronRight size={14} aria-hidden="true" />
                  Show
                </>
              )}
            </button>
          </div>

          <div
            id="categories-panel"
            role="region"
            aria-labelledby="categories-heading"
            hidden={!catsOpen}
          >
            <div className="grid grid-cols-2 gap-2">
              {primaryCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCategoryClick(c.id)}
                  className={[
                    "w-full inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                    category === c.id
                      ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
                      : "bg-white hover:bg-neutral-50 border-gray-300 text-gray-700",
                  ].join(" ")}
                >
                  {c.icon ? <c.icon size={16} /> : null}
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>

            {extraCats.length > 0 && (
              <>
                <button
                  type="button"
                  className="mt-2 text-xs text-[rgb(var(--accent))] underline underline-offset-2"
                  onClick={() => setShowMoreCats((v) => !v)}
                  aria-expanded={showMoreCats ? "true" : "false"}
                  aria-controls="extra-categories"
                >
                  {showMoreCats ? "Show fewer categories" : "Show more categories"}
                </button>

                <div
                  id="extra-categories"
                  role="region"
                  hidden={!showMoreCats}
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  {extraCats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCategoryClick(c.id)}
                      className={[
                        "w-full inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                        category === c.id
                          ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
                          : "bg-white hover:bg-neutral-50 border-gray-300 text-gray-700",
                      ].join(" ")}
                    >
                      {c.icon ? <c.icon size={16} /> : null}
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Sort */}
        <section aria-labelledby="sort-heading" className="rounded-md border bg-white">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-left md:cursor-default"
            aria-expanded={sortOpen ? "true" : "false"}
            aria-controls="sort-panel"
            id="sort-heading"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <ArrowUpDown size={16} className="opacity-70" />
              Sort
            </span>
            <span className="md:hidden">
              {sortOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>

          <div
            id="sort-panel"
            role="region"
            aria-labelledby="sort-heading"
            className={[sortOpen ? "block" : "hidden", "md:block", "px-3 pb-3"].join(
              " "
            )}
          >
            <div className="grid grid-cols-1 gap-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sort"
                  value="relevance"
                  checked={sortBy === "relevance"}
                  onChange={() => setSortBy("relevance")}
                />
                Relevance
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sort"
                  value="distance"
                  checked={sortBy === "distance"}
                  onChange={() => setSortBy("distance")}
                />
                Distance
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sort"
                  value="name"
                  checked={sortBy === "name"}
                  onChange={() => setSortBy("name")}
                />
                Name (A–Z)
              </label>
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              Distance uses your location if available, otherwise the map centre.
            </div>
          </div>
        </section>

        {/* Mobile results + selected place */}
        <section className="md:hidden space-y-3">
          {selectedPlace ? <SelectedPlaceSummary /> : null}

          <div className="relative">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Results</div>
              <div className="text-xs text-neutral-500">
                {filteredSorted.length} item{filteredSorted.length === 1 ? "" : "s"}
              </div>
            </div>

            {loading || globalLoading ? (
              <Spinner />
            ) : filteredSorted.length === 0 ? (
              <div className="text-xs text-neutral-500">
                {resultsListEmptyMessage}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredSorted.slice(0, 40).map((p) => {
                  const isSelected = selectedPlace?.id === p.id;
                  const d = distanceM(origin, p);
                  const km = Number.isFinite(d) ? (d / 1000).toFixed(1) : undefined;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setLockOnSelection(true);
                          setSelectedPlace(p);
                          setCenter([p.lat, p.lng]);
                          setZoom(16);
                        }}
                        className={[
                          "w-full text-left rounded-md border p-2 transition",
                          isSelected
                            ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))]"
                            : "bg-white hover:bg-neutral-50 border-gray-300",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {p.name ?? "Unnamed place"}
                            </div>
                            {p.address ? (
                              <div className="truncate text-xs text-neutral-600">
                                {p.address}
                              </div>
                            ) : null}
                            {km ? (
                              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-neutral-700">
                                <Navigation size={12} />
                                {km} km
                              </div>
                            ) : null}
                          </div>
                          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-neutral-700">
                            {p.category}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Desktop selected place + results */}
        {selectedPlace && (
          <div className="hidden md:block">
            <div className="border-t" />
            <SelectedPlaceSummary />
          </div>
        )}

        <div className="relative border-t pt-3 hidden md:block">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Results</div>
            <div className="text-xs text-neutral-500">
              {filteredSorted.length} item{filteredSorted.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading || globalLoading ? (
            <Spinner />
          ) : filteredSorted.length === 0 ? (
            <div className="text-xs text-neutral-500">
              {resultsListEmptyMessage}
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredSorted.slice(0, 20).map((p) => {
                const isSelected = selectedPlace?.id === p.id;
                const d = distanceM(origin, p);
                const km = Number.isFinite(d) ? (d / 1000).toFixed(1) : undefined;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setLockOnSelection(true);
                        setSelectedPlace(p);
                        setCenter([p.lat, p.lng]);
                        setZoom(16);
                      }}
                      className={[
                        "w-full text-left rounded-md border p-2 transition",
                        isSelected
                          ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))]"
                          : "bg-white hover:bg-neutral-50 border-gray-300",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {p.name ?? "Unnamed place"}
                          </div>
                          {p.address ? (
                            <div className="truncate text-xs text-neutral-600">
                              {p.address}
                            </div>
                          ) : null}
                          {km ? (
                            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-neutral-700">
                              <Navigation size={12} />
                              {km} km
                            </div>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] text-neutral-700">
                          {p.category}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
