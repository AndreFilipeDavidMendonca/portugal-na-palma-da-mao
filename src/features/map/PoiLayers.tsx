import React from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import type { PoiCategory } from "@/utils/constants";
import { CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import markerSvgRaw from "@/assets/icons/marker.svg?raw";

type AnyGeo = any;

/** ===== Escalas ===== */
function getIconSizeForZoom(zoom: number): number {
    // Ícones SVG (categorias) — crescimento contido
    // z10 → 14px ... z19 → 24px
    const Z0 = 10, Z1 = 19;
    const P0 = 14, P1 = 24;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function getPinSizeForZoom(zoom: number): number {
    // Marker genérico (marker.svg) para zooms baixos
    // z7 → 6px ... z10 → 12px
    const Z0 = 7, Z1 = 10;
    const P0 = 6, P1 = 12;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

/** Hook para acompanhar o zoom atual do mapa */
function useMapZoom(): number {
    const map = useMap();
    const [zoom, setZoom] = React.useState(map.getZoom());

    React.useEffect(() => {
        const handleZoom = () => setZoom(map.getZoom());
        map.on("zoomend", handleZoom);
        return () => {
            map.off("zoomend", handleZoom);
        };
    }, [map]);

    return zoom;
}
function createLowZoomMarker(category: PoiCategory, sizePx: number) {
    const color = CATEGORY_COLORS[category] || "#777";

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

    return L.divIcon({
        html,
        className: "poi-pin",
        iconSize: [sizePx, sizePx],
        iconAnchor: [sizePx / 2, sizePx],
    });
}

/** Ícone SVG colorido e dimensionado */
function createPoiIcon(category: PoiCategory, sizePx: number) {
    const color = CATEGORY_COLORS[category] || "#666";
    const svg = POI_ICON_SVG_RAW[category];

    if (!svg) {
        return L.divIcon({
            html: `<span style="display:inline-block;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color}"></span>`,
            className: "",
            iconSize: [sizePx, sizePx],
            iconAnchor: [sizePx / 2, sizePx],
        });
    }

    return L.divIcon({
        html: `
      <div style="
        width:${sizePx}px;height:${sizePx}px;
        display:flex;align-items:center;justify-content:center;
        color:${color};line-height:0;
        filter: drop-shadow(0 0 1px rgba(0,0,0,.35));
      ">
        <span style="display:inline-block;width:100%;height:100%;">${svg}</span>
      </div>
    `,
        className: "poi-divicon",
        iconSize: [sizePx, sizePx],
        iconAnchor: [sizePx / 2, sizePx],
    });
}


/** Categorias */
export function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};
    if (p.historic === "palace" || p.building === "palace" || p.castle_type === "palace") return "palace";
    if (p.historic === "castle" || p.building === "castle" || p.castle_type === "castle" || p.castle_type === "fortress") return "castle";
    if (p.historic === "ruins" && p.ruins === "castle") return "ruins";
    if (p.historic === "monument") return "monument";
    if (p.historic === "ruins") return "ruins";
    if (p.historic === "church" || p.amenity === "place_of_worship" || p.building === "church") return "church";
    if (p.tourism === "viewpoint") return "viewpoint";
    if (p.leisure === "park") return "park";
    if (p.boundary === "protected_area") return "protected_area";
    return null;
}

/** Filtro por tipos */
export function filterFeaturesByTypes(geo: AnyGeo | null, selected: Set<PoiCategory>) {
    if (!geo) return null;
    if (!geo.features) return geo;
    const feats = geo.features.filter((f: any) => {
        const k = getPoiCategory(f);
        return k ? selected.has(k) : false;
    });
    return { type: "FeatureCollection", features: feats };
}

/** Camada principal */
export function PoiPointsLayer({
                                   data,
                                   selectedTypes,
                               }: {
    data: AnyGeo;
    selectedTypes: Set<PoiCategory>;
}) {
    const zoom = useMapZoom();
    const showSvg = zoom >= 13;
    const iconSize = getIconSizeForZoom(zoom);
    const pinSize  = getPinSizeForZoom(zoom);

    const key = `${Array.from(selectedTypes).sort().join(",")}|mode:${showSvg ? "svg" : "pin"}|z:${zoom}`;

    return (
        <GeoJSON
            key={key}
            data={data as any}
            filter={(f: any) => {
                const cat = getPoiCategory(f);
                return cat ? selectedTypes.has(cat) : false;
            }}
            pointToLayer={(feature: any, latlng: LatLngExpression) => {
                const cat = getPoiCategory(feature);

                if (!showSvg) {
                    // —— zoom baixo: usar marker.svg pintado
                    const icon = createLowZoomMarker(cat || "castle", pinSize);
                    return L.marker(latlng, { icon });
                }

                // —— zoom alto: usar SVG da categoria
                if (cat) {
                    const icon = createPoiIcon(cat, iconSize);
                    return L.marker(latlng, { icon });
                }

                // fallback
                return L.circleMarker(latlng, {
                    radius: 2,
                    weight: 0.6,
                    color: "#555",
                    fillColor: "#555",
                    fillOpacity: 0.7,
                });
            }}
            onEachFeature={(feature, layer) => {
                const p = (feature as any).properties || {};
                const name = p["name:pt"] || p.name || "Sem nome";
                const cat = getPoiCategory(feature);
                const catLabel = cat ? cat : "";
                layer.bindTooltip(
                    `<strong>${name}</strong>${catLabel ? `<div>${catLabel}</div>` : ""}`,
                    { direction: "top", offset: L.point(0, -10), sticky: true }
                );
            }}
        />
    );
}

/** Áreas (parques, zonas protegidas) */
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