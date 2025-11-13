// src/utils/constants.ts

// === Tiles (Home e Modal) ===
export const WORLD_BASE =
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
export const WORLD_LABELS =
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";
export const DISTRICT_DETAIL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const DISTRICT_LABELS =
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

// === Overpass endpoints ===
export const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
] as const;

// === WMS SIPA / Património Cultural (oficial) ===
// Base do serviço WMS (SIPA/DGT)
export const SIPA_WMS_URL =
    "http://servicos.dgterritorio.pt/SDISNITZWMS_SIPA_PPP_IHRU/service.svc/get";

// Nome da layer a usar (ajustar depois de ver o GetCapabilities)
export const SIPA_WMS_LAYER = "SIPA_PPP_IHRU"; // TODO: confirmar nome real da layer

export const CATEGORY_COLORS: Record<PoiCategory, string> = {
    castle: "#7e1616",
    palace: "#501c61",
    monument: "#24338e",
    ruins: "#51362c",
    church: "#3890dc",
    viewpoint: "#ae7710",
    park: "#2E7D32",
    protected_area: "#66BB6A",
};

// === Categorias de POI ===
export type PoiCategory =
    | "castle"
    | "palace"
    | "monument"
    | "ruins"
    | "church"
    | "viewpoint"
    | "park"
    | "protected_area";

// === Labels ===
export const POI_LABELS: Record<PoiCategory, string> = {
    castle: "Castelos",
    palace: "Palácios",
    monument: "Monumentos",
    ruins: "Ruínas",
    church: "Igrejas",
    viewpoint: "Miradouros",
    park: "Parques",
    protected_area: "Áreas protegidas",
};

// === Lista para UI (filtros) ===
export const POI_CATEGORIES: { key: PoiCategory; label: string; kind: "node" | "area" }[] = [
    { key: "castle", label: POI_LABELS.castle, kind: "node" },
    { key: "palace", label: POI_LABELS.palace, kind: "node" },
    { key: "monument", label: POI_LABELS.monument, kind: "node" },
    { key: "ruins", label: POI_LABELS.ruins, kind: "node" },
    { key: "church", label: POI_LABELS.church, kind: "node" },
    { key: "viewpoint", label: POI_LABELS.viewpoint, kind: "node" },
    { key: "park", label: POI_LABELS.park, kind: "area" },
    /*{ key: "protected_area", label: POI_LABELS.protected_area, kind: "area" },*/
];

// === Defaults ===
export const DEFAULT_POI_TYPES: Readonly<PoiCategory[]> = [];

// === Cores e Z-index das camadas ===
export const COLOR_RIVER = "#1E88E5";
export const COLOR_LAKE = "#42A5F5";
export const COLOR_RAIL = "#616161";
export const COLOR_ROAD = "#F57C00";
export const COLOR_PEAK = "#6D4C41";

export const Z_RIVERS = 420;
export const Z_LAKES = 422;
export const Z_RAIL = 424;
export const Z_ROADS = 426;
export const Z_PEAKS = 428;
export const Z_PLACES = 440;