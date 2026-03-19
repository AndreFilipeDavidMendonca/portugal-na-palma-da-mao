// src/utils/icons.ts
import type { PoiCategory } from "@/utils/constants";

import castleSvgRaw from "@/assets/icons/castle.svg?raw";
import palaceSvgRaw from "@/assets/icons/palace.svg?raw";
import monumentSvgRaw from "@/assets/icons/monument.svg?raw";
import ruinsSvgRaw from "@/assets/icons/ruins.svg?raw";
import churchSvgRaw from "@/assets/icons/church.svg?raw";
import viewpointSvgRaw from "@/assets/icons/viewpoint.svg?raw";
import parkSvgRaw from "@/assets/icons/park.svg?raw";
import trailSvgRaw from "@/assets/icons/trail.svg?raw";

import gastronomySvgRaw from "@/assets/icons/gastronomy.svg?raw";
import craftsSvgRaw from "@/assets/icons/crafts.svg?raw";
import accommodationSvgRaw from "@/assets/icons/accommodation.svg?raw";
import eventSvgRaw from "@/assets/icons/event.svg?raw";

function normalizeSvg(svg: string) {
  let s = svg.trim();

  if (!/width=/.test(s) || !/height=/.test(s) || !/preserveAspectRatio=/.test(s)) {
    s = s.replace(
      "<svg",
      '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"'
    );
  }

  return s;
}

export const POI_ICON_SVG_RAW: Record<PoiCategory, string> = {
  castle: normalizeSvg(castleSvgRaw),
  palace: normalizeSvg(palaceSvgRaw),
  monument: normalizeSvg(monumentSvgRaw),
  ruins: normalizeSvg(ruinsSvgRaw),
  church: normalizeSvg(churchSvgRaw),

  viewpoint: normalizeSvg(viewpointSvgRaw),
  park: normalizeSvg(parkSvgRaw),
  trail: normalizeSvg(trailSvgRaw),

  gastronomy: normalizeSvg(gastronomySvgRaw),
  crafts: normalizeSvg(craftsSvgRaw),
  accommodation: normalizeSvg(accommodationSvgRaw),
  event: normalizeSvg(eventSvgRaw),
};