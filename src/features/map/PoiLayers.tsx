import React from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";

import { POI_LABELS, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import markerSvgRaw from "@/assets/icons/marker.svg?raw";

type AnyGeo = any;

function getName(p: any) {
    const tags = p?.tags ?? {};
    return (
        p?.namePt ||
        p?.["name:pt"] ||
        tags?.["name:pt"] ||
        p?.name ||
        tags?.name ||
        p?.["name:en"] ||
        tags?.["name:en"] ||
        null
    );
}

export function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};
    const tags = p.tags ?? {};

    const rawCat: string | undefined =
        (typeof p.category === "string" && p.category) ||
        (typeof tags.category === "string" && tags.category) ||
        (typeof p.historic === "string" && p.historic) ||
        (typeof tags.historic === "string" && tags.historic) ||
        undefined;

    if (!rawCat) return null;

    switch (rawCat.toLowerCase()) {
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
        case "gastronomy":
        case "restaurant":
        case "food":
            return "gastronomy";
        case "crafts":
        case "artisan":
        case "artesanato":
            return "crafts";
        case "accommodation":
        case "hotel":
        case "hostel":
        case "lodging":
            return "accommodation";
        case "event":
        case "evento":
        case "events":
            return "event";
        default:
            return null;
    }
}

/* =========================
   Zoom helpers
========================= */

function getIconSizeForZoom(zoom: number): number {
    const Z0 = 14,
        Z1 = 20;
    const P0 = 20,
        P1 = 28;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function getPinSizeForZoom(zoom: number): number {
    const Z0 = 7,
        Z1 = 10;
    const P0 = 6,
        P1 = 12;
    const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
    return Math.round(P0 + (P1 - P0) * t);
}

function useMapZoom() {
    const map = useMap();
    const [zoom, setZoom] = React.useState<number>(() => map.getZoom());

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
   Icon cache
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
   PoiPointsLayer
   - Icon >= 13
   - Tooltips >= 15
   - Abre no máximo 5 (mais centrais)
========================= */

export function PoiPointsLayer({
                                   data,
                                   selectedTypes,
                                   nonce = 0,
                                   onSelect,
                               }: {
    data: AnyGeo;
    selectedTypes: ReadonlySet<PoiCategory>;
    nonce?: number;
    onSelect?: (feature: any) => void;
}) {
    const map = useMap();
    const zoom = useMapZoom();

    const MIN_ZOOM_ICONS = 13;
    const MIN_ZOOM_TOOLTIPS = 18;

    const MAX_OPEN = 5; // 👈 aqui (fixo em 5 como pediste)

    const showIcons = zoom >= MIN_ZOOM_ICONS;
    const showTooltips = zoom >= MIN_ZOOM_TOOLTIPS;

    const iconSize = getIconSizeForZoom(zoom);
    const pinSize = getPinSizeForZoom(zoom);

    const nothingSelected = !selectedTypes || selectedTypes.size === 0;

    const key = React.useMemo(() => {
        const cats = Array.from(selectedTypes ?? []).sort().join(",");
        return `${cats}|mode:${showIcons ? "svg" : "pin"}|z:${zoom}|n:${nonce}`;
    }, [selectedTypes, showIcons, zoom, nonce]);

    const layersRef = React.useRef<L.Layer[]>([]);
    const rafRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        layersRef.current = [];
    }, [key]);

    const updateVisibleTooltips = React.useCallback(() => {
        // if zoom too low, make sure everything is closed
        if (!showTooltips) {
            for (const l of layersRef.current) (l as any)?.closeTooltip?.();
            return;
        }

        const bounds = map.getBounds();
        const center = bounds.getCenter();

        const candidates: { layer: any; dist: number }[] = [];

        for (const l of layersRef.current) {
            const anyL: any = l as any;
            const ll = anyL?.getLatLng?.();
            if (!ll) continue;

            if (!bounds.contains(ll)) {
                anyL.closeTooltip?.();
                continue;
            }

            candidates.push({ layer: anyL, dist: center.distanceTo(ll) });
        }

        candidates.sort((a, b) => a.dist - b.dist);

        const keep = new Set(candidates.slice(0, MAX_OPEN).map((c) => c.layer));

        for (const l of layersRef.current) {
            const anyL: any = l as any;
            if (!anyL?.getLatLng?.()) continue;

            if (keep.has(anyL)) anyL.openTooltip?.();
            else anyL.closeTooltip?.();
        }
    }, [map, showTooltips]);

    const scheduleUpdate = React.useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(updateVisibleTooltips);
    }, [updateVisibleTooltips]);

    React.useEffect(() => {
        const handler = () => scheduleUpdate();

        map.on("zoomend", handler);
        map.on("moveend", handler);

        scheduleUpdate();

        return () => {
            map.off("zoomend", handler);
            map.off("moveend", handler);
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            for (const l of layersRef.current) (l as any)?.closeTooltip?.();
        };
    }, [map, scheduleUpdate]);

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

                if (!showIcons) {
                    const icon = createLowZoomMarker(cat, pinSize);
                    const m = L.marker(latlng, { icon });
                    if (onSelect) m.on("click", () => onSelect(feature));
                    return m;
                }

                if (cat) {
                    const icon = createPoiIcon(cat, iconSize);
                    const m = L.marker(latlng, { icon });
                    if (onSelect) m.on("click", () => onSelect(feature));
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
                layersRef.current.push(layer);

                const p = (feature as any).properties || {};
                const name = getName(p) || "Sem nome";
                const catKey = getPoiCategory(feature);
                const catLabel = catKey ? POI_LABELS[catKey] : "";

                const html = `<strong>${name}</strong>${catLabel ? `<div>${catLabel}</div>` : ""}`;

                layer.bindTooltip(html, {
                    className: "poi-tooltip",
                    direction: "top",
                    offset: L.point(0, -10),
                    sticky: false,
                    opacity: 1,
                    permanent: showTooltips,
                    interactive: false,
                });

                const anyLayer: any = layer as any;
                anyLayer.closeTooltip?.();

                anyLayer.once?.("add", () => {
                    anyLayer.closeTooltip?.();
                    scheduleUpdate();
                });

                if (anyLayer._icon) anyLayer._icon.style.cursor = "pointer";
                if (anyLayer._path) anyLayer._path.style.cursor = "pointer";
            }}
        />
    );
}

/* =========================
   PoiAreasLayer
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