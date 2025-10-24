"use client";

import { ChangeEvent } from "react";
import { cn } from "@/lib/cn";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

export default function SearchBox({
  value,
  onChange,
  placeholder = "Search coffee, clinics, coworking...",
  className,
  inputClassName,
}: Props) {
  return (
    <div className={cn("search-box", className)}>
      <input
        className={cn("search-input", inputClassName)}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
