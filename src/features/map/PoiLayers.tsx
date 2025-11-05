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


function tag(p: any, key: string) {
    // tenta properties[key] e depois properties.tags[key]
    return p?.[key] ?? p?.tags?.[key] ?? null;
}

function getName(p: any) {
    const tags = p?.tags ?? {};
    return p?.["name:pt"] || p?.name || tags["name:pt"] || tags.name || null;
}

// ————— categorias com fallback para properties.tags.* —————
export function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};

    const historic    = tag(p, "historic");
    const building    = tag(p, "building");
    const castle_type = tag(p, "castle_type");
    const ruins       = tag(p, "ruins");
    const amenity     = tag(p, "amenity");
    const tourism     = tag(p, "tourism");
    const leisure     = tag(p, "leisure");
    const boundary    = tag(p, "boundary");

    // PALACE (dar prioridade para não cair em castle)
    if (historic === "palace" || building === "palace" || castle_type === "palace")
        return "palace";

    // CASTLE / FORTRESS
    if (historic === "castle" || building === "castle" ||
        castle_type === "castle" || castle_type === "fortress")
        return "castle";

    // RUINS de castelo
    if (historic === "ruins" && ruins === "castle") return "ruins";

    // MONUMENT / RUINS (genéricas)
    if (historic === "monument") return "monument";
    if (historic === "ruins")    return "ruins";

    // CHURCH (várias formas)
    if (historic === "church" || amenity === "place_of_worship" || building === "church")
        return "church";

    // VIEWPOINT
    if (tourism === "viewpoint") return "viewpoint";

    // ÁREAS
    if (leisure === "park")            return "park";
    if (boundary === "protected_area") return "protected_area";

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
    const showSvg = zoom >= 14;
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
                const name = getName(p) || "Sem nome";
                const cat  = getPoiCategory(feature) ?? "";
                layer.bindTooltip(
                    `<strong>${name}</strong>${cat ? `<div>${cat}</div>` : ""}`,
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