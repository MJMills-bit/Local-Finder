import { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

type Props = PropsWithChildren<{ className?: string }>;

export default function ListCard({ className, children }: Props) {
  return (
    <li className={cn("list-card", className)}>
      {children}
    </li>
  );
}
