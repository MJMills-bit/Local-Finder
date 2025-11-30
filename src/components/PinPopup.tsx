// src/components/PinPopup.tsx
"use client";

import * as React from "react";
import { MapPin, Phone, Globe, Navigation } from "lucide-react";
import useStore, { type Place } from "@/lib/useStore";

type Props = { place: Place };

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

function directionsHref(p: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

export default function PinPopup({ place }: Props) {
  const setSelectedPlace = useStore((s) => s.setSelectedPlace);
  const setLockOnSelection = useStore((s) => s.setLockOnSelection);

  const phone = place.tags?.phone;
  const website = normalizeWebsite(place.tags?.website);
  const websiteHost = hostFrom(website);

    return (
    <div
  className="md:hidden rounded-xl border p-3 shadow-sm bg-white space-y-2 w-[min(75vw,320px)]"
  onClick={() => {
    setSelectedPlace(place);
    setLockOnSelection(true);
  }}
>
      {/* Name */}
      <div className="font-semibold leading-tight text-[15px]">
        {place.name}
      </div>

      {/* Address */}
      {place.address ? (
        <div className="flex items-start gap-2 text-[13px] text-neutral-800">
          <MapPin size={14} className="mt-[2px] text-neutral-500" />
          <span className="break-words">{place.address}</span>
        </div>
      ) : null}

      {/* Phone */}
      {phone ? (
        <div className="flex items-start gap-2 text-[13px]">
          <Phone size={14} className="mt-[2px] text-neutral-500" />
          <a
            href={`tel:${phone}`}
            className="hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {phone}
          </a>
        </div>
      ) : null}

      {/* Website */}
      {website ? (
        <div className="flex items-start gap-2 text-[13px]">
          <Globe size={14} className="mt-[2px] text-neutral-500" />
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgb(var(--accent))] underline decoration-1 underline-offset-2 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {websiteHost ?? website}
          </a>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-6">
        <a
          href={directionsHref(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-[rgb(var(--accent))] px-3 py-[6px] text-[12px] font-medium text-white shadow-sm hover:opacity-95"
          title="Open directions"
          onClick={(e) => e.stopPropagation()}
        >
          <Navigation size={14} />
          Directions
        </a>
      </div>
    </div>
  );

}
