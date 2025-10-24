"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, Props>(({ className, ...props }, ref) => {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});
Input.displayName = "Input";

export default Input;
