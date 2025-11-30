// src/components/ui/layouts/TrayLayout.tsx
"use client";

import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function TrayLayout({ open, onClose, children }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          "fixed inset-0 z-[1300] bg-black/30 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Tray */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={[
          "fixed bottom-4 left-1/2 z-[1310] -translate-x-1/2",
          "w-[min(92vw,720px)] rounded-2xl border bg-white shadow-xl",
          "transition-transform",
          open ? "translate-y-0" : "translate-y-[120%]",
        ].join(" ")}
      >
        <div className="max-h-[70svh] overflow-y-auto p-3">{children}</div>
      </aside>
    </>
  );
}
