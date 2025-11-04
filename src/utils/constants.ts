// src/utils/constants.ts

// === Tiles (home e modal) ===
export const WORLD_BASE =
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
export const WORLD_LABELS =
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

export const DISTRICT_BASE =
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
export const DISTRICT_LABELS =
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";

export const DISTRICT_DETAIL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';


// === Overpass ===
export const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
] as const;

// === Categorias de POI ===
// (1) Nodes “culturais”
export const CULTURAL_NODE_TAGS = [
    "castle",
    "monument",
    "memorial",
    "ruins",
    "church",
    "museum",
    "artwork",
    "viewpoint",
    "attraction",
] as const;
export type CulturalNode = typeof CULTURAL_NODE_TAGS[number];

// (2) Áreas relevantes
export const AREA_TAGS = [
    "park",
    "protected_area",
] as const;
export type AreaTag = typeof AREA_TAGS[number];

// (3) União total usada nos filtros
export type PoiCategory = CulturalNode | AreaTag;

// Lista (útil para UIs) com label e tipo
export const POI_CATEGORIES: { key: PoiCategory; label: string; kind: "node" | "area" }[] = [
    // nodes
    { key: "castle",         label: "Castelos",         kind: "node" },
    { key: "monument",       label: "Monumentos",       kind: "node" },
    { key: "memorial",       label: "Memoriais",        kind: "node" },
    { key: "ruins",          label: "Ruínas",           kind: "node" },
    { key: "church",         label: "Igrejas",          kind: "node" },
    { key: "museum",         label: "Museus",           kind: "node" },
    { key: "artwork",        label: "Obras de arte",    kind: "node" },
    { key: "viewpoint",      label: "Miradouros",       kind: "node" },
    { key: "attraction",     label: "Atrações",         kind: "node" },
    // áreas
    { key: "park",           label: "Parques",          kind: "area" },
    { key: "protected_area", label: "Áreas protegidas", kind: "area" },
];

// Por omissão mostramos só os culturais “duros” (nodes)
export const DEFAULT_POI_TYPES: Readonly<PoiCategory[]> = [...CULTURAL_NODE_TAGS];

// Mapa de labels para acesso rápido
export const POI_LABELS: Record<PoiCategory, string> = {
    castle: "Castelos",
    monument: "Monumentos",
    memorial: "Memoriais",
    ruins: "Ruínas",
    church: "Igrejas",
    museum: "Museus",
    artwork: "Obras de arte",
    viewpoint: "Miradouros",
    attraction: "Atrações",
    park: "Parques",
    protected_area: "Áreas protegidas",
};



// === Estilos e z-index para camadas do mini-mapa ===
export const COLOR_RIVER = "#1E88E5";
export const COLOR_LAKE  = "#42A5F5";
export const COLOR_RAIL  = "#616161";
export const COLOR_ROAD  = "#F57C00";
export const COLOR_PEAK  = "#6D4C41";

export const Z_RIVERS = 420;
export const Z_LAKES  = 422;
export const Z_RAIL   = 424;
export const Z_ROADS  = 426;
export const Z_PEAKS  = 428;
export const Z_PLACES = 440;

// ... (mantém o que já tens)

export const POI_COLORS: Record<PoiCategory, string> = {
    castle:         "#8E24AA", // roxo
    monument:       "#3949AB", // azul
    memorial:       "#546E7A", // cinza azulado
    ruins:          "#6D4C41", // castanho
    church:         "#1E88E5", // azul médio
    museum:         "#00897B", // teal
    artwork:        "#F4511E", // laranja
    viewpoint:      "#FB8C00", // âmbar
    attraction:     "#D81B60", // magenta
    park:           "#2E7D32", // verde
    protected_area: "#66BB6A", // verde claro
};