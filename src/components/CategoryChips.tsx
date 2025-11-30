"use client";

import React from "react";
import useStore from "@/lib/useStore";

type Cat = {
  id:
    | "all"
    | "coffee"
    | "coworking"
    | "clinic"
    | "restaurant"
    | "bar"
    | "supermarket"
    | "pharmacy"
    | "hotel"
    | "hospital"
    | "bank"
    | "atm"
    | "fuel"
    | "park";
  label: string;
};

const CHIPS: Cat[] = [
  { id: "all", label: "All" },
  { id: "coffee", label: "Coffee" },
  { id: "coworking", label: "Coworking" },
  { id: "clinic", label: "Clinics" },
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

export default function CategoryChips({ maxVisible = 8 }: { maxVisible?: number }) {
  const category = useStore((s) => s.category);
  const setCategory = useStore((s) => s.setCategory);

  const visible = CHIPS.slice(0, Math.max(1, maxVisible));

  return (
    // Desktop and tablet only
    <div className="hidden md:block">
      <div className="flex gap-2 overflow-x-auto whitespace-nowrap no-scrollbar px-3 py-2">
        {visible.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={active}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                active
                  ? "bg-[rgb(var(--accent))]/10 border-[rgb(var(--accent))] text-[rgb(var(--accent))]"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-neutral-50",
              ].join(" ")}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
