// src/components/TopSearch.tsx
"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import useStore from "@/lib/useStore";

export default function TopSearch() {
  const [local, setLocal] = React.useState("");

  const query = useStore((s) => s.query);
  const center = useStore((s) => s.center);
  const userLocation = useStore((s) => s.userLocation);

  const setQuery = useStore((s) => s.setQuery);
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setLockOnSelection = useStore((s) => s.setLockOnSelection);

  // Keep input in sync if query is changed elsewhere
  React.useEffect(() => {
    if (typeof query === "string") {
      setLocal(query);
    }
  }, [query]);

  const hasLocation =
    !!userLocation ||
    (Array.isArray(center) &&
      center.length === 2 &&
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1]));

  const clearAll = () => {
    setLocal("");
    setQuery("");
    setSelectedPlace(null);
    setLockOnSelection(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const term = local.trim();
    if (!term || !hasLocation) return;

    // Only drive the app via the global query.
    // MapClient will react to `query` and call /api/overpass.
    setQuery(term);
    setSelectedPlace(null);
    setLockOnSelection(false);
  };

  return (
    <div className="sticky top-[56px] z-[1200] border-b border-muted bg-white/90 backdrop-blur">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-3 py-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 text-gray-700 pointer-events-none"
            size={18}
            aria-hidden
          />
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="Search places (e.g., Lorraine, cafe, Spur)…"
            className="w-full rounded-lg border bg-white pl-10 pr-10 py-2 shadow outline-none focus:ring-2 ring-[rgb(var(--accent))]"
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
            disabled={!hasLocation}
          />
          {local && hasLocation && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-700 hover:bg-black/5"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {!hasLocation && (
          <p className="mt-1 text-xs text-gray-500">
            Unlock search by pressing “Press to locate”.
          </p>
        )}
      </form>
    </div>
  );
}
