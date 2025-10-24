"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export default function Chip({ active, className, ...props }: Props) {
  return (
    <button
      className={cn(active ? "chip-accent" : "chip", className)}
      {...props}
    />
  );
}
