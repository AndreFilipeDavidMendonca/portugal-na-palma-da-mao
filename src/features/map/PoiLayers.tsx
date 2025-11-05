import React from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import type { PoiCategory } from "@/utils/constants";
import { POI_COLORS, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

type AnyGeo = any;

/** ===== Escalas ===== */
function getIconSizeForZoom(zoom: number): number {
    // z13 → 14px ... z17 → 22px (crescimento suave e contido)
    const Z0 = 13, Z1 = 17;
    const P0 = 14, P1 = 22;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function getDotRadiusForZoom(zoom: number): number {
    // z6 → 1px ... z12 → 3px
    const Z0 = 6, Z1 = 12;
    const R0 = 1, R1 = 3;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return R0 + (R1 - R0) * t;
}

/** Hook para acompanhar o zoom atual do mapa */
function useMapZoom(): number {
    const map = useMap();
    const [zoom, setZoom] = React.useState(map.getZoom());

    React.useEffect(() => {
        const onZoomEnd = () => setZoom(map.getZoom());
        map.on("zoomend", onZoomEnd);

        return () => {
            map.off("zoomend", onZoomEnd);
        };
    }, [map]);

    return zoom;
}

/** Ícone SVG colorido e dimensionado */
function createPoiIcon(category: PoiCategory, sizePx: number) {
    const color = CATEGORY_COLORS[category] || "#666";
    const svg = POI_ICON_SVG_RAW[category];

    if (!svg) {
        // fallback: ponto simples
        return L.divIcon({
            html: `<span style="display:inline-block;width:${sizePx}px;height:${sizePx}px;border-radius:50%;background:${color}"></span>`,
            className: "",
            iconSize: [sizePx, sizePx],
            iconAnchor: [sizePx / 2, sizePx / 2],
        });
    }

    return L.divIcon({
        html: `
      <div style="
        width:${sizePx}px;height:${sizePx}px;
        display:flex;align-items:center;justify-content:center;
        color:${color};
        line-height:0;
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
    const showSvg = zoom >= 12; // 👈 ícones só a partir do zoom 13
    const iconSize = getIconSizeForZoom(zoom);
    const dotRadius = getDotRadiusForZoom(zoom);

    const key = `${Array.from(selectedTypes).sort().join(",")}|mode:${showSvg ? "svg" : "dots"}|z:${zoom}`;

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
                    // ——— modo pontos (zoom < 13)
                    const color = (cat && POI_COLORS[cat]) || "#455A64";
                    return L.circleMarker(latlng, {
                        radius: dotRadius,
                        weight: 0.6,
                        color,
                        fillColor: color,
                        fillOpacity: 0.7,
                    });
                }

                // ——— modo ícones SVG (zoom ≥ 13)
                if (cat) {
                    const icon = createPoiIcon(cat, iconSize);
                    return L.marker(latlng, { icon });
                }

                // fallback
                return L.circleMarker(latlng, {
                    radius: dotRadius,
                    weight: 0.6,
                    color: "#455A64",
                    fillColor: "#455A64",
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