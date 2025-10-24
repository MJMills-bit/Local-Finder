"use client";

type Category = { id: string; label: string };

const categories: Category[] = [
  { id: "coffee", label: "Coffee" },
  { id: "bakery", label: "Bakery" },
  { id: "restaurant", label: "Restaurant" },
  { id: "gym", label: "Gym" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "atm", label: "ATM" },
];

export default function CategoryChips() {
  return (
    <div className="sticky top-[calc(64px+56px)] z-20 bg-white border-b px-3 py-2 overflow-x-auto md:hidden [-webkit-overflow-scrolling:touch]">
      <div className="flex gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            className="rounded-full border whitespace-nowrap px-3 py-1.5 text-sm transition border-gray-300 text-gray-700 hover:bg-neutral-50"
            aria-pressed="false"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
