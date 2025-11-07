// src/features/map/PoiLayers.tsx
import React, { useRef } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";

import type { PoiCategory } from "@/utils/constants";
import { CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { fetchPoiInfo } from "@/lib/poiInfo";

import markerSvgRaw from "@/assets/icons/marker.svg?raw";
import PoiModal from "@/pages/poi/PoiModal";

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

    const historic    = tag(p, "historic");
    const building    = tag(p, "building");
    const castle_type = tag(p, "castle_type");
    const ruins       = tag(p, "ruins");
    const amenity     = tag(p, "amenity");
    const tourism     = tag(p, "tourism");
    const leisure     = tag(p, "leisure");
    const boundary    = tag(p, "boundary");

    if (historic === "palace" || building === "palace" || castle_type === "palace")
        return "palace" as PoiCategory;

    if (
        historic === "castle" || building === "castle" ||
        castle_type === "castle" || castle_type === "fortress"
    ) return "castle" as PoiCategory;

    if (historic === "ruins" && ruins === "castle") return "ruins" as PoiCategory;

    if (historic === "monument") return "monument" as PoiCategory;
    if (historic === "ruins")    return "ruins" as PoiCategory;

    if (historic === "church" || amenity === "place_of_worship" || building === "church")
        return "church" as PoiCategory;

    if (tourism === "viewpoint") return "viewpoint" as PoiCategory;

    if (leisure === "park")            return "park" as PoiCategory;
    if (boundary === "protected_area") return "protected_area" as PoiCategory;

    return null;
}

/** Filtra um FeatureCollection pelos tipos selecionados. */
export function filterFeaturesByTypes(
    geo: AnyGeo | null,
    selected: Set<PoiCategory>
) {
    if (!geo) return null;
    if (!geo.features) return geo;

    // Sem seleção → coleção vazia (não mostra nada)
    if (!selected || selected.size === 0)
        return { type: "FeatureCollection", features: [] };

    const feats = geo.features.filter((f: any) => {
        const k = getPoiCategory(f);
        return k ? selected.has(k) : false;
    });
    return { type: "FeatureCollection", features: feats };
}

/* =========================
   Escalas / ícones
   ========================= */
function getIconSizeForZoom(zoom: number): number {
    const Z0 = 14, Z1 = 20;
    const P0 = 20, P1 = 25;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function getPinSizeForZoom(zoom: number): number {
    const Z0 = 7,  Z1 = 10;
    const P0 = 6,  P1 = 12;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

/** Zoom atual do mapa (sem tipos malucos no cleanup) */
function useMapZoom(): number {
    const map = useMap();
    const [zoom, setZoom] = React.useState(() => map.getZoom());

    React.useEffect(() => {
        const onZoom = () => setZoom(map.getZoom());
        map.on("zoomend", onZoom);
        return () => { map.off("zoomend", onZoom); };
    }, [map]);

    return zoom;
}

/* =========================
   Criação dos ícones
   ========================= */
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
    return L.divIcon({
        html,
        className: "poi-pin",
        iconSize: [sizePx, sizePx],
        iconAnchor: [sizePx / 2, sizePx],
    });
}

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

/* =========================
   Camada de Pontos + Modal interno
   ========================= */
export function PoiPointsLayer({
                                   data,
                                   selectedTypes,
                                   nonce = 0,
                               }: {
    data: AnyGeo;
    selectedTypes: ReadonlySet<PoiCategory>;
    /** força remount quando muda (ex.: ao limpar filtros) */
    nonce?: number;
}) {
    const zoom = useMapZoom();
    const showSvg = zoom >= 13;
    const iconSize = getIconSizeForZoom(zoom);
    const pinSize  = getPinSizeForZoom(zoom);

    // “Sem nada selecionado” => esconder tudo (GeoJSON.filter retorna false p/ todos)
    const nothingSelected = !selectedTypes || selectedTypes.size === 0;

    // Modal interno do layer
    const [open, setOpen]   = React.useState(false);
    const [poi,  setPoi]    = React.useState<any | null>(null);
    const [info, setInfo]   = React.useState<any | null>(null);
    const lastClickIdRef = useRef(0);

    const handleClose = React.useCallback(() => {
        setOpen(false);
        setPoi(null);
        setInfo(null);
    }, []);

    // Key inclui o nonce para “remontar” o GeoJSON quando limpas
    const key = `${Array.from(selectedTypes ?? []).sort().join(",")}|mode:${showSvg ? "svg" : "pin"}|z:${zoom}|n:${nonce}`;

    return (
        <>
            <GeoJSON
                key={key}
                data={data as any}
                filter={(f: any) => {
                    if (nothingSelected) return false; // ← esconde tudo sem seleção
                    const cat = getPoiCategory(f);
                    return cat ? selectedTypes.has(cat) : false;
                }}
                pointToLayer={(feature: any, latlng: LatLngExpression) => {
                    const cat = getPoiCategory(feature);

                    if (!showSvg) {
                        const icon = createLowZoomMarker(cat, pinSize);
                        return L.marker(latlng, { icon });
                    }

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
                    } as L.CircleMarkerOptions);
                }}
                onEachFeature={(feature: any, layer: L.Layer) => {
                    const p = (feature as any).properties || {};
                    const name = getName(p) || "Sem nome";
                    const cat  = getPoiCategory(feature) ?? "";
                    layer.bindTooltip(
                        `<strong>${name}</strong>${cat ? `<div>${cat}</div>` : ""}`,
                        { direction: "top", offset: L.point(0, -10), sticky: true }
                    );

                    // Clique → abre modal interno
                    layer.on("click", async () => {
                        const props  = { ...(feature.properties || {}) };
                        const tags   = props.tags ?? {};
                        const merged = { ...props, ...tags, tags };

                        if (!merged.id && feature.id)   merged.id = feature.id;
                        if (!merged.type && feature.type) merged.type = feature.type;

                        const poiNorm = { ...feature, properties: merged };
                        const clickId = ++lastClickIdRef.current;

                        setPoi(poiNorm);
                        setOpen(true);

                        try {
                            const wikidata  = merged.wikidata || merged["wikidata:id"] || null;
                            const wikipedia = merged.wikipedia || merged["wikipedia:pt"] || merged["wikipedia:en"] || null;

                            const extra = await fetchPoiInfo({ wikidata, wikipedia });
                            if (clickId === lastClickIdRef.current) setInfo(extra ?? null);
                        } catch {
                            if (clickId === lastClickIdRef.current) setInfo(null);
                        }
                    });

                    const anyLayer: any = layer as any;
                    if (anyLayer._icon) anyLayer._icon.style.cursor = "pointer";
                    if (anyLayer._path) anyLayer._path.style.cursor = "pointer";
                }}
            />

            {/* Modal sobreposto */}
            <PoiModal open={open} onClose={handleClose} poi={poi} info={info} />
        </>
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