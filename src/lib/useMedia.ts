"use client";
import { useEffect, useState } from "react";
export function useIsDesktop(min = 768) {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(min-width: ${min}px)`);
    const on = () => setDesk(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [min]);
  return desk;
}
