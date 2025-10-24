import { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

type Props = PropsWithChildren<{ className?: string }>;

export default function Card({ className, children }: Props) {
  return <div className={cn("card", className)}>{children}</div>;
}
