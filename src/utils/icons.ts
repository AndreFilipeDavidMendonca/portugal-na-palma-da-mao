import type { PoiCategory } from "@/utils/constants";

// Importa SVGs (Vite devolve URLs finais prontas para <img> ou Leaflet L.icon)
import castleUrl    from "@/assets/icons/castle.svg";
import palaceUrl    from "@/assets/icons/palace.svg";
import monumentUrl  from "@/assets/icons/monument.svg";
import ruinsUrl     from "@/assets/icons/ruins.svg";
import churchUrl    from "@/assets/icons/church.svg";
import viewpointUrl from "@/assets/icons/viewpoint.svg";

export const POI_ICON_URL: Record<PoiCategory, string> = {
    castle:         castleUrl,
    palace:         palaceUrl,
    monument:       monumentUrl,
    ruins:          ruinsUrl,
    church:         churchUrl,
    viewpoint:      viewpointUrl,
    // áreas (não usamos ícone específico — o layer faz fallback para círculo)
    park:           "",
    protected_area: "",
};

export const DEFAULT_ICON_SIZE: [number, number]   = [22, 22];
export const DEFAULT_ICON_ANCHOR: [number, number] = [11, 20];