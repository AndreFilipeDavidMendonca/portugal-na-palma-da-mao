import { useEffect, useState } from "react";

export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQueryList = window.matchMedia(query);
    const onChange = () => setMatches(mediaQueryList.matches);

    if ("addEventListener" in mediaQueryList) mediaQueryList.addEventListener("change", onChange);
    else (mediaQueryList as any).addListener(onChange);

    setMatches(mediaQueryList.matches);

    return () => {
      if ("removeEventListener" in mediaQueryList) mediaQueryList.removeEventListener("change", onChange);
      else (mediaQueryList as any).removeListener(onChange);
    };
  }, [query]);

  return matches;
}
