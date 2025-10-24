'use client';

import React, { useMemo, useState, useEffect } from 'react';
import useStore from '@/lib/useStore';
import type { Category, Place } from '@/lib/types';
import type { LucideProps } from 'lucide-react';
import Spinner from './Spinner'; // ← fixed path
import {
  Coffee,
  Building2,
  Landmark,
  MapPin,
  Globe,
  Phone,
  Tag,
  Info,
  ArrowUpDown,
  Navigation,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

/* =========================
   Small helpers
   ========================= */

function normalizeWebsite(url?: string): string | undefined {
  if (!url) return;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(withProto);
    return u.toString();
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

// Haversine distance in meters (from [lat,lng] to place)
function distanceM(from: [number, number] | null, p: Place): number {
  if (!from) return Number.POSITIVE_INFINITY;
  const [lat1, lon1] = from;
  const lat2 = p.lat;
  const lon2 = p.lng;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
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
    .join(' ')
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

/* =========================
   Sorting
   ========================= */

type SortKey = 'relevance' | 'distance' | 'name';

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

  if (sortBy === 'distance') {
    withMeta.sort((a, b) => a.d - b.d);
  } else if (sortBy === 'name') {
    withMeta.sort((a, b) => a.p.name.localeCompare(b.p.name));
  } else {
    withMeta.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      if (a.d !== b.d) return a.d - b.d;
      return a.p.name.localeCompare(b.p.name);
    });
  }

  return withMeta.map((x) => x.p);
}

/* =========================
   Category button
   ========================= */

const categoryConfig: Array<{
  id: Category;
  label: string;
  icon?: React.ComponentType<LucideProps>;
}> = [
  { id: 'all', label: 'All' },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'coworking', label: 'Coworking', icon: Building2 },
  { id: 'clinic', label: 'Clinics', icon: Landmark },

  // Extended set
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'fastfood', label: 'Fast Food' },
  { id: 'bar', label: 'Bars' },                 // visible
  { id: 'pub', label: 'Pubs' },                 // extra
  { id: 'supermarket', label: 'Supermarkets' }, // visible
  { id: 'shop', label: 'Shops' },               // extra
  { id: 'pharmacy', label: 'Pharmacies' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'hospital', label: 'Hospitals' },
  { id: 'bank', label: 'Banks' },
  { id: 'atm', label: 'ATMs' },
  { id: 'fuel', label: 'Petrol' },
  { id: 'park', label: 'Parks' },
  { id: 'attraction', label: 'Attractions' },
];

function CategoryButton({
  id,
  label,
  active,
  onClick,
  Icon,
}: {
  id: Category;
  label: string;
  active: boolean;
  onClick: (c: Category) => void;
  Icon?: React.ComponentType<LucideProps>;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={[
        'w-full inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
        active
          ? 'bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))] text-[rgb(var(--accent))]'
          : 'bg-white hover:bg-neutral-50 border-gray-300 text-gray-700',
      ].join(' ')}
    >
      {Icon ? <Icon size={16} /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

/* =========================
   Aside
   ========================= */

export default function CategoryAside() {
  // store
  const category = useStore((s) => s.category);
  const setCategory = useStore((s) => s.setCategory);
  const places = useStore((s) => s.places);
  const query = useStore((s) => s.query);
  const center = useStore((s) => s.center);
  const userLocation = useStore((s) => s.userLocation);
  const selectedPlace = useStore((s) => s.selectedPlace);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setLockOnSelection = useStore((s) => s.setLockOnSelection);

  // also read global loading so spinner shows in all cases (harmless enhancement)
  const globalLoading = useStore((s) => s.loading);

  // sort UI state
  const [sortBy, setSortBy] = useState<SortKey>('relevance');

  // collapsible categories panel
  const [catsOpen, setCatsOpen] = useState(true);

  // "More categories" collapse
  const [showMoreCats, setShowMoreCats] = useState(false);

  // spinner state with minimum display time
  const [loading, setLoading] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<Category | null>(null);
  const [loadingSince, setLoadingSince] = useState<number | null>(null);
  const MIN_SPINNER_MS = 250;

  // Option A: which categories show in the primary grid
  const { primary: primaryCats, extra: extraCats } = useMemo(() => {
    const primaryIds: Category[] = [
      'all',
      'coffee',
      'coworking',
      'clinic',
      'restaurant',
      'bar',
      'supermarket',
      'pharmacy',
    ];
    return {
      primary: categoryConfig.filter((c) => primaryIds.includes(c.id)),
      extra: categoryConfig.filter((c) => !primaryIds.includes(c.id)),
    };
  }, []);

  // Filter + sort list for the aside
  const filteredSorted: Place[] = useMemo(() => {
    const base =
      category === 'all' ? places : places.filter((p) => p.category === category);

    const qLower = query.trim().toLowerCase();
    const filtered = qLower ? base.filter((p) => queryScore(p, qLower) > 0) : base;

    const from: [number, number] | null = userLocation
      ? [userLocation.lat, userLocation.lng]
      : center ?? null;

    return sortPlaces(filtered, sortBy, { qLower, from });
  }, [places, category, query, sortBy, userLocation, center]);

  // Turn off spinner once the list updates for the pending category, ensuring min time shown
  useEffect(() => {
    if (!loading || pendingCategory === null) return;
    if (category !== pendingCategory) return; // wait until category state has applied

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

  // Keep selection valid when filters change
  useEffect(() => {
    if (!selectedPlace) return;
    if (!filteredSorted.some((p) => p.id === selectedPlace.id)) {
      setSelectedPlace(null);
    }
  }, [filteredSorted, selectedPlace, setSelectedPlace]);

  // Selected place details
  const name = selectedPlace?.name ?? 'Unnamed place';
  const address = selectedPlace?.address;
  const amenity = selectedPlace?.tags?.amenity;
  const website = normalizeWebsite(selectedPlace?.tags?.website);
  const websiteHost = hostFrom(website);
  const phone = selectedPlace?.tags?.phone;

  // Origin for distance chip
  const origin: [number, number] | null = userLocation
    ? [userLocation.lat, userLocation.lng]
    : center ?? null;

  // Category click: always show spinner and collapse sections
  const handleCategoryClick = (c: Category) => {
    setPendingCategory(c);
    setLoading(true);
    setLoadingSince(performance.now());

    setCategory(c);
    setShowMoreCats(false);
    setCatsOpen(false);
  };

  // ARIA literals to satisfy editor axe
  const catsOpenAria: 'true' | 'false' = catsOpen ? 'true' : 'false';
  const moreCatsAria: 'true' | 'false' = showMoreCats ? 'true' : 'false';

  return (
    <aside
      className="
        sticky top-[calc(56px+48px)] z-10
        h-[calc(100dvh-56px-48px)] w-full md:w-[18rem]
        border-r bg-white/90 backdrop-blur overflow-y-auto
      "
    >
      <div className="px-3 py-3 space-y-4">
        {/* Categories (collapsible) */}
        <section aria-labelledby="categories-heading" className="rounded-md">
          <div className="mb-2 flex items-center justify-between">
            <div id="categories-heading" className="text-sm font-medium">
              Categories
            </div>
            <button
              type="button"
              onClick={() => setCatsOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-[rgb(var(--accent))]"
              aria-expanded={catsOpenAria}
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
            {/* Primary group */}
            <div className="grid grid-cols-2 gap-2">
              {primaryCats.map((c) => (
                <CategoryButton
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  Icon={c.icon}
                  active={category === c.id}
                  onClick={handleCategoryClick}
                />
              ))}
            </div>

            {/* Extra group (collapsible) */}
            {extraCats.length > 0 && (
              <>
                <button
                  type="button"
                  className="mt-2 text-xs text-[rgb(var(--accent))] underline underline-offset-2"
                  onClick={() => setShowMoreCats((v) => !v)}
                  aria-expanded={moreCatsAria}
                  aria-controls="extra-categories"
                  id="toggle-extra-categories"
                >
                  {showMoreCats ? 'Show fewer categories' : 'Show more categories'}
                </button>

                <div
                  id="extra-categories"
                  role="region"
                  aria-labelledby="toggle-extra-categories"
                  hidden={!showMoreCats}
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  {extraCats.map((c) => (
                    <CategoryButton
                      key={c.id}
                      id={c.id}
                      label={c.label}
                      Icon={c.icon}
                      active={category === c.id}
                      onClick={handleCategoryClick}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Sorting */}
        <div className="rounded-md border bg-white p-2">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <ArrowUpDown size={16} className="opacity-70" />
            Sort
          </div>
          <div className="grid grid-cols-1 gap-1">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sort"
                value="relevance"
                checked={sortBy === 'relevance'}
                onChange={() => setSortBy('relevance')}
              />
              Relevance
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sort"
                value="distance"
                checked={sortBy === 'distance'}
                onChange={() => setSortBy('distance')}
              />
              Distance
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="sort"
                value="name"
                checked={sortBy === 'name'}
                onChange={() => setSortBy('name')}
              />
              Name (A–Z)
            </label>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Distance uses your location if available; otherwise the map center.
          </div>
        </div>

        {/* Results list */}
        <div className="relative border-t pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Results</div>
            <div className="text-xs text-neutral-500">
              {filteredSorted.length} item{filteredSorted.length === 1 ? '' : 's'}
            </div>
          </div>

          {(loading || globalLoading) ? (
            <Spinner />
          ) : filteredSorted.length === 0 ? (
            <div className="text-xs text-neutral-500">
              No places. Try a different category or search.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredSorted.slice(0, 20).map((p) => {
                const isSelected = selectedPlace?.id === p.id;
                const d = distanceM(origin, p);
                const km = Number.isFinite(d)
                  ? (d / 1000).toFixed(d < 1000 ? 1 : 1)
                  : undefined;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setLockOnSelection(true);
                        setSelectedPlace(p);
                      }}
                      className={[
                        'w-full text-left rounded-md border p-2 transition',
                        isSelected
                          ? 'bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))]'
                          : 'bg-white hover:bg-neutral-50 border-gray-300',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
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

        {/* Selected place card */}
        {selectedPlace ? (
          <>
            <div className="border-t" />
            <div className="rounded-xl border p-3 shadow-sm bg-white space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold leading-tight">{name}</div>
                {amenity ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-neutral-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
                    {amenity}
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

              {/* Extra tags */}
              {(() => {
                const tags: string[] = [];
                const tt = selectedPlace?.tags ?? {};
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
            </div>

            <div className="pt-2">
              <a
                href={directionsHref(selectedPlace)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-md bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
                title="Open directions"
              >
                Directions →
              </a>
            </div>

            {!address && !website && !phone && !amenity ? (
              <div className="flex items-start gap-2 text-xs text-neutral-500">
                <Info size={14} className="mt-[2px]" />
                <span>
                  Limited details for this place on OpenStreetMap. We’ll show more when available.
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
