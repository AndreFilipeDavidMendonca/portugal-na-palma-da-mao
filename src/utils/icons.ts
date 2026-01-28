// src/utils/icons.ts
import type { PoiCategory } from "@/utils/constants";

// IMPORTA COMO TEXTO (Vite):
import castleSvgRaw        from "@/assets/icons/castle.svg?raw";
import palaceSvgRaw        from "@/assets/icons/palace.svg?raw";
import monumentSvgRaw      from "@/assets/icons/monument.svg?raw";
import ruinsSvgRaw         from "@/assets/icons/ruins.svg?raw";
import churchSvgRaw        from "@/assets/icons/church.svg?raw";
import viewpointSvgRaw     from "@/assets/icons/viewpoint.svg?raw";
import parkSvgRaw          from "@/assets/icons/park.svg?raw";
import trailSvgRaw         from "@/assets/icons/trail.svg?raw";

// === Comerciais (novos) ===
import gastronomySvgRaw    from "@/assets/icons/gastronomy.svg?raw";
import craftsSvgRaw        from "@/assets/icons/crafts.svg?raw";
import accommodationSvgRaw from "@/assets/icons/accommodation.svg?raw";
import eventSvgRaw         from "@/assets/icons/event.svg?raw";

// Garante que tudo pinta a partir de currentColor (remove fills rígidos)
function normalizeSvg(svg: string) {
    // remove fills explícitos e aplica fill="currentColor" na root se não existir
    let s = svg.replace(/fill="[^"]*"/g, 'fill="currentColor"');

    if (!/fill="currentColor"/.test(s)) {
        s = s.replace(/<svg([^>]+)>/, '<svg$1 fill="currentColor">');
    }

    // remove width/height fixos para escalar por CSS
    s = s.replace(/(width|height)="[^"]*"/g, "");

    return s.trim();
}

export const POI_ICON_SVG_RAW: Record<PoiCategory, string> = {
    // Cultura
    castle: normalizeSvg(castleSvgRaw),
    palace: normalizeSvg(palaceSvgRaw),
    monument: normalizeSvg(monumentSvgRaw),
    ruins: normalizeSvg(ruinsSvgRaw),
    church: normalizeSvg(churchSvgRaw),

    // Natureza
    viewpoint: normalizeSvg(viewpointSvgRaw),
    park: normalizeSvg(parkSvgRaw),
    trail: normalizeSvg(trailSvgRaw),

    // Comerciais
    gastronomy: normalizeSvg(gastronomySvgRaw),
    crafts: normalizeSvg(craftsSvgRaw),
    accommodation: normalizeSvg(accommodationSvgRaw),
    event: normalizeSvg(eventSvgRaw),
};