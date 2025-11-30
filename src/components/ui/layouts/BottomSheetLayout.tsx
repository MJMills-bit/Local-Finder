// src/components/ui/layouts/BottomSheetLayout.tsx
"use client";

import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheetLayout({ open, onClose, children }: Props) {
  return (
    <>
      <div
        className={[
          "fixed inset-0 z-[1300] bg-black/30 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={[
          "fixed inset-x-0 bottom-0 z-[1310]",
          "rounded-t-2xl border-t bg-white shadow-xl",
          "transition-transform",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="mx-auto max-w-xl p-3 max-h-[75svh] overflow-y-auto">
          {children}
        </div>
      </section>
    </>
  );
}
