"use client";

import { useEffect, useState } from "react";

// Tailwind's `lg` breakpoint, for behaviour (not just styling) that differs on desktop.
export const DESKTOP_QUERY = "(min-width: 1024px)";

// False on the server and on the first client render, then the real value.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
