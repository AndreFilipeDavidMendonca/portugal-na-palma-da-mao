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

// === Categorias de POI ===
export type PoiCategory =
// Cultura
    | "castle"
    | "palace"
    | "monument"
    | "ruins"
    | "church"

    // Natureza
    | "viewpoint"
    | "park"
    | "trail"

    // Comercial (subcategorias)
    | "gastronomy"
    | "crafts"
    | "accommodation"
    | "event";

// === Cores por categoria ===
export const CATEGORY_COLORS: Record<PoiCategory, string> = {
  // Cultura
  castle: "#7E1616",
  palace: "#3890DC",
  monument: "#24338E",
  ruins: "#51362C",
  church: "#501C61",

  // Natureza
  viewpoint: "#8C6A1A",
  park: "#1B5E20",
  trail: "#4CAF50",

  // Comercial
  gastronomy: "#CA6609",
  crafts: "#8D6E63",
  accommodation: "#1E88E5",
  event: "#ED0023",
};

// === Labels ===
export const POI_LABELS: Record<PoiCategory, string> = {
    // Cultura
    castle: "Castelos",
    palace: "Palácios",
    monument: "Monumentos",
    ruins: "Arqueologia",
    church: "Igrejas",

    // Natureza
    viewpoint: "Miradouros",
    park: "Parques",
    trail: "Trilhos",

    // Comercial
    gastronomy: "Gastronomia",
    crafts: "Artesanato",
    accommodation: "Alojamento",
    event: "Eventos",
};

// === Lista de categorias (UI filters) ===
export const POI_CATEGORIES: {
    key: PoiCategory;
    label: string;
    kind: "node" | "area";
}[] = [
    // Cultura
    { key: "castle", label: POI_LABELS.castle, kind: "node" },
    { key: "palace", label: POI_LABELS.palace, kind: "node" },
    { key: "monument", label: POI_LABELS.monument, kind: "node" },
    { key: "ruins", label: POI_LABELS.ruins, kind: "node" },
    { key: "church", label: POI_LABELS.church, kind: "node" },

    // Natureza
    { key: "viewpoint", label: POI_LABELS.viewpoint, kind: "node" },
    { key: "park", label: POI_LABELS.park, kind: "area" },
    { key: "trail", label: POI_LABELS.trail, kind: "area" },

    // Comercial
    { key: "gastronomy", label: POI_LABELS.gastronomy, kind: "node" },
    { key: "crafts", label: POI_LABELS.crafts, kind: "node" },
    { key: "accommodation", label: POI_LABELS.accommodation, kind: "node" },
    { key: "event", label: POI_LABELS.event, kind: "node" },
];

// === Defaults ===
export const DEFAULT_POI_TYPES: Readonly<PoiCategory[]> = [];

// === Cores de elementos do mapa ===
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