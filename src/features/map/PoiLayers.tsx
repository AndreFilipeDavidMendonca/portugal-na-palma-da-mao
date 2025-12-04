import React from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";

import type { PoiCategory } from "@/utils/constants";
import { CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import markerSvgRaw from "@/assets/icons/marker.svg?raw";

type AnyGeo = any;

/* =========================
   Helpers genéricos
   ========================= */
function tag(p: any, key: string) {
    return p?.[key] ?? p?.tags?.[key] ?? null;
}

function getName(p: any) {
    const tags = p?.tags ?? {};
    return p?.["name:pt"] || p?.name || tags["name:pt"] || tags.name || null;
}

/* =========================
   Categorias
   ========================= */
export function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};
    const tags = p.tags ?? {};

    // 1) NOVO: categoria vinda do backend (.pt)
    const rawCat: string | undefined =
        (typeof p.category === "string" && p.category) ||
        (typeof tags.category === "string" && tags.category) ||
        (typeof p.historic === "string" && p.historic) ||
        (typeof tags.historic === "string" && tags.historic) ||
        undefined;

    if (rawCat) {
        const c = rawCat.toLowerCase();

        switch (c) {
            case "castle":
                return "castle";
            case "palace":
                return "palace";
            case "monument":
                return "monument";
            case "ruins":
            case "ruin":
                return "ruins";
            case "church":
            case "chapel":
            case "igreja":
                return "church";
            case "viewpoint":
            case "miradouro":
                return "viewpoint";
            case "park":
            case "garden":
            case "jardim":
                return "park";
            case "trail":
            case "trilho":
            case "hiking":
                return "trail";
        }
    }

    // 2) LEGADO: inferir a partir de tags tipo OSM (se alguma vez vierem)
    const historic    = tag(p, "historic");
    const building    = tag(p, "building");
    const castle_type = tag(p, "castle_type");
    const ruins       = tag(p, "ruins");
    const amenity     = tag(p, "amenity");
    const tourism     = tag(p, "tourism");
    const leisure     = tag(p, "leisure");
    const boundary    = tag(p, "boundary");
    const route       = tag(p, "route");

    if (historic === "palace" || building === "palace" || castle_type === "palace")
        return "palace";

    if (
        historic === "castle" ||
        building === "castle" ||
        castle_type === "castle" ||
        castle_type === "fortress"
    )
        return "castle";

    if (historic === "ruins" && ruins === "castle") return "ruins";

    if (historic === "monument") return "monument";
    if (historic === "ruins")    return "ruins";

    if (historic === "church" || amenity === "place_of_worship" || building === "church")
        return "church";

    if (tourism === "viewpoint") return "viewpoint";

    if (leisure === "park")            return "park";

    if (route === "hiking" || route === "foot") return "trail";

    return null;
}

/** Filtra um FeatureCollection pelos tipos selecionados. */
export function filterFeaturesByTypes(
    geo: AnyGeo | null,
    selected: Set<PoiCategory>
) {
    if (!geo) return null;
    if (!geo.features) return geo;

    if (!selected || selected.size === 0)
        return { type: "FeatureCollection", features: [] };

    const feats = geo.features.filter((f: any) => {
        const k = getPoiCategory(f);
        return k ? selected.has(k) : false;
    });
    return { type: "FeatureCollection", features: feats };
}

/* =========================
   Escalas / zoom
   ========================= */
function getIconSizeForZoom(zoom: number): number {
    const Z0 = 14, Z1 = 20;
    const P0 = 20, P1 = 28;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function getPinSizeForZoom(zoom: number): number {
    const Z0 = 7,  Z1 = 10;
    const P0 = 6,  P1 = 12;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

/** Zoom atual do mapa (cleanup seguro) */
function useMapZoom(): number {
    const map = useMap();
    const [zoom, setZoom] = React.useState(() => map.getZoom());

    React.useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on("zoomend", onZoom);
        return () => {
            map.off("zoomend", onZoom);
        };
    }, [map]);

    return zoom;
}

/* =========================
   Ícones com cache
   ========================= */
const iconCache = new Map<string, L.DivIcon>();

function getCachedIcon(key: string, html: string, size: number, anchorY?: number) {
    const k = `${key}|${size}`;
    const cached = iconCache.get(k);
    if (cached) return cached;
    const div = L.divIcon({
        html,
        className: "poi-divicon",
        iconSize: [size, size],
        iconAnchor: [size / 2, anchorY ?? size],
    });
    iconCache.set(k, div);
    return div;
}

function createLowZoomMarker(category: PoiCategory | null, sizePx: number) {
    const color = (category && CATEGORY_COLORS[category]) || "#777";
    const html = `
    <div style="
      width:${sizePx}px; height:${sizePx}px;
      display:flex; align-items:center; justify-content:center;
      line-height:0; color:${color};
      filter: drop-shadow(0 0 1px rgba(0,0,0,.35));
    ">
      <span style="display:inline-block;width:100%;height:100%;">${markerSvgRaw}</span>
    </div>
  `;
    return getCachedIcon(`low:${category ?? "none"}`, html, sizePx);
}

function createPoiIcon(category: PoiCategory, sizePx: number) {
    const color = CATEGORY_COLORS[category] || "#666";
    const svg = POI_ICON_SVG_RAW[category];

    const html = svg
        ? `
      <div style="
        width:${sizePx}px;height:${sizePx}px;
        display:flex;align-items:center;justify-content:center;
        color:${color};line-height:0;
        filter: drop-shadow(0 0 1px rgba(0,0,0,.35));
      ">
        <span style="display:inline-block;width:100%;height:100%;">${svg}</span>
      </div>
    `
        : `<span style="display:inline-block;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color}"></span>`;

    return getCachedIcon(`poi:${category}`, html, sizePx);
}

/* =========================
   Camada de Pontos
   ========================= */
export function PoiPointsLayer({
                                   data,
                                   selectedTypes,
                                   nonce = 0,
                                   onSelect,
                               }: {
    data: any;
    selectedTypes: ReadonlySet<PoiCategory>;
    nonce?: number;
    onSelect?: (feature: any) => void;
}) {
    const zoom = useMapZoom();
    const showSvg = zoom >= 13;
    const iconSize = getIconSizeForZoom(zoom);
    const pinSize  = getPinSizeForZoom(zoom);

    const nothingSelected = !selectedTypes || selectedTypes.size === 0;

    const key = `${Array.from(selectedTypes ?? [])
        .sort()
        .join(",")}|mode:${showSvg ? "svg" : "pin"}|z:${zoom}|n:${nonce}`;

    return (
        <GeoJSON
            key={key}
            data={data as any}
            filter={(f: any) => {
                if (nothingSelected) return false;
                const cat = getPoiCategory(f);
                return cat ? selectedTypes.has(cat) : false;
            }}
            pointToLayer={(feature: any, latlng: LatLngExpression) => {
                const cat = getPoiCategory(feature);

                if (!showSvg) {
                    const icon = createLowZoomMarker(cat, pinSize);
                    const m = L.marker(latlng, { icon });
                    if (onSelect) m.on("click", () => onSelect(feature));
                    const el = (m as any)._icon as HTMLElement | undefined;
                    if (el) el.style.cursor = "pointer";
                    return m;
                }

                if (cat) {
                    const icon = createPoiIcon(cat, iconSize);
                    const m = L.marker(latlng, { icon });
                    if (onSelect) m.on("click", () => onSelect(feature));
                    const el = (m as any)._icon as HTMLElement | undefined;
                    if (el) el.style.cursor = "pointer";
                    return m;
                }

                const cm = L.circleMarker(latlng, {
                    radius: 2,
                    weight: 0.6,
                    color: "#555",
                    fillColor: "#555",
                    fillOpacity: 0.7,
                } as L.CircleMarkerOptions);
                if (onSelect) cm.on("click", () => onSelect(feature));
                return cm;
            }}
            onEachFeature={(feature: any, layer: L.Layer) => {
                const p = (feature as any).properties || {};
                const name = getName(p) || "Sem nome";
                const cat  = getPoiCategory(feature) ?? "";
                layer.bindTooltip(
                    `<strong>${name}</strong>${cat ? `<div>${cat}</div>` : ""}`,
                    { direction: "top", offset: L.point(0, -10), sticky: true }
                );
                const anyLayer: any = layer as any;
                if (anyLayer._icon) anyLayer._icon.style.cursor = "pointer";
                if (anyLayer._path) anyLayer._path.style.cursor = "pointer";
            }}
        />
    );
}

/* =========================
   Áreas/Polígonos
   ========================= */
export function PoiAreasLayer({ data }: { data: AnyGeo }) {
    return (
        <GeoJSON
            data={data as any}
            style={() => ({
                color: "#2E7D32",
                weight: 1,
                fillColor: "#A5D6A7",
                fillOpacity: 0.25,
            })}
        />
    );
}