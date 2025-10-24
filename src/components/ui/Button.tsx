"use client";

import { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "ghost" | "primary";
type Size = "sm" | "md";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
>;

export default function Button({
  children,
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  const base = "btn";
  const variantClass =
    variant === "ghost"
      ? "btn-ghost"
      : variant === "primary"
      ? "btn-primary"
      : "";

  const sizeClass = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";

  return (
    <>
    <button className={cn(base, variantClass, sizeClass, className)} {...props}>
      {children}
    </button>
    </>
  );
}
