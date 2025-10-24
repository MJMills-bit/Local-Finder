// src/components/Logo.tsx
"use client";

import React from "react";

type Props = React.SVGProps<SVGSVGElement> & {
  /** Height of the pin relative to surrounding text. e.g. "1em", "20px" */
  size?: string | number;
};

export default function Logo({ size = "1em", className, ...props }: Props) {
  const height = typeof size === "number" ? `${size}px` : size;

  return (
    <svg
      viewBox="0 0 160 250"
      preserveAspectRatio="xMidYMid meet"
      height={height}
      className={["inline-block align-middle text-green-700", className ?? ""].join(" ")}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <ellipse cx="80" cy="230" rx="54" ry="12" fill="currentColor" opacity={0.08} />
      <path d="M80,0C35,0,0,35,0,80c0,70,80,170,80,170s80-100,80-170C160,35,125,0,80,0Z" fill="currentColor" />
      <circle cx="80" cy="85" r="30" fill="currentColor" opacity={0.12} />
      <circle cx="80" cy="85" r="28" fill="#fff" />
    </svg>
  );
}
