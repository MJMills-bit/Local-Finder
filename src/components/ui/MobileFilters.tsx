"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import CategoryAside from "@/components/CategoryAside";
import BottomSheetLayout from "@/components/ui/layouts/BottomSheetLayout";
import TrayLayout from "@/components/ui/layouts/TrayLayout";

/**
 * MobileFilters
 * Mobile-only inline bar that sits directly beneath the search input.
 * Tapping it opens CategoryAside in a sheet or tray.
 */
export default function MobileFilters() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"tray" | "sheet">("tray");
  const Layout = mode === "sheet" ? BottomSheetLayout : TrayLayout;

  return (
    <>
      {/* Inline, under the search. No fixed/absolute. */}
      <div className="md:hidden px-3 mt-2">
        <div className="flex gap-3 bg-white/90 backdrop-blur-md border rounded-full px-4 py-2 shadow-lg">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 font-medium text-sm"
            aria-label="Open filters"
          >
            <Filter size={18} />
            Filters
          </button>

          <button
            onClick={() => setMode((m) => (m === "sheet" ? "tray" : "sheet"))}
            className="text-xs text-gray-500 hover:underline"
            title="Switch filter layout mode"
          >
            {mode === "tray" ? "Try sheet" : "Try tray"}
          </button>
        </div>
      </div>

      <Layout open={open} onClose={() => setOpen(false)}>
        <CategoryAside />
      </Layout>
    </>
  );
}
