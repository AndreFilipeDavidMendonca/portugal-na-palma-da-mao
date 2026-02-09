// src/features/map/DistrictsHoverLayer.tsx
import { GeoJSON, useMap } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import L from "leaflet";

type Props = {
    data: any;
    onClickDistrict?: (name: string | undefined, feature: any) => void;
    capitalsByDistrictId?: Map<number, [number, number]>;
};

const MIN_ZOOM_TOOLTIPS = 7;
// 0.18 = ignora 18% de margem em cada lado (menos ruído nas bordas)
const CENTER_MARGIN = 0.18;

function getName(f: any): string | undefined {
    return f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"] || undefined;
}

function getDistrictId(f: any): number | null {
    const id = f?.properties?.id;
    return typeof id === "number" ? id : null;
}

export default function DistrictsHoverLayer({ data, onClickDistrict, capitalsByDistrictId }: Props) {
    const map = useMap();
    const geoRef = useRef<L.GeoJSON | null>(null);
    const hoveredRef = useRef<L.Path | null>(null);
    const rafRef = useRef<number | null>(null);

    const styles = useMemo(() => {
        const cs = getComputedStyle(document.documentElement);
        const borderColor = cs.getPropertyValue("--bg-panel").trim() || "#122b1a";
        const fillColor = cs.getPropertyValue("--border").trim() || "#254b32";
        const fillHover = cs.getPropertyValue("--border-2").trim() || "#2d593b";
        const hoverBorder = cs.getPropertyValue("--gold-dark").trim() || "#b38f3b";

        return {
            base: { color: borderColor, weight: 1.6, fillColor, fillOpacity: 1 } as L.PathOptions,
            hover: { color: hoverBorder, weight: 2.2, fillColor: fillHover, fillOpacity: 0.6 } as L.PathOptions,
        };
    }, []);

    const updateTooltips = useCallback(() => {
        const g = geoRef.current;
        if (!g) return;

        const z = map.getZoom();
        if (z < MIN_ZOOM_TOOLTIPS) {
            g.eachLayer((layer: any) => layer?.closeTooltip?.());
            return;
        }

        const mapBounds = map.getBounds();
        const safeBounds = CENTER_MARGIN > 0 ? mapBounds.pad(-CENTER_MARGIN) : mapBounds;

        g.eachLayer((layer: any) => {
            const tt = layer?.getTooltip?.();
            if (!tt) return;

            const feature = layer?.feature;
            const districtId = getDistrictId(feature);

            // 1) capital se existir  2) fallback: centro do bounds do distrito
            const cap = districtId != null ? capitalsByDistrictId?.get(districtId) : null;
            const bounds: L.LatLngBounds | null = layer?.getBounds?.() ?? null;
            const fallbackCenter = bounds?.isValid?.() ? bounds.getCenter() : null;

            const anchor = cap ? L.latLng(cap[0], cap[1]) : fallbackCenter;
            if (!anchor) {
                layer.closeTooltip?.();
                return;
            }

            const forceOpen = hoveredRef.current === layer;
            const shouldOpen = forceOpen || safeBounds.contains(anchor);

            if (shouldOpen) {
                tt.setLatLng(anchor); // ✅ move tooltip para capital/centro
                layer.openTooltip?.();
            } else {
                layer.closeTooltip?.();
            }
        });
    }, [map, capitalsByDistrictId]);

    const scheduleUpdate = useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(updateTooltips);
    }, [updateTooltips]);

    useEffect(() => {
        const on = () => scheduleUpdate();
        map.on("zoomend", on);
        map.on("moveend", on);

        scheduleUpdate();

        return () => {
            map.off("zoomend", on);
            map.off("moveend", on);
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, [map, scheduleUpdate]);

    const onEachFeature = useCallback(
        (feature: any, layer: L.Path) => {
            const name = getName(feature);
            if (!name) return;

            (layer as any).bindTooltip(name, {
                className: "district-badge",
                direction: "top",
                sticky: false,
                permanent: false,
                opacity: 1,
                offset: [0, -10],
            });
            (layer as any).closeTooltip?.();

            layer.on("click", (e: any) => {
                const domEv = e?.originalEvent;
                if (domEv) {
                    L.DomEvent.preventDefault(domEv);
                    L.DomEvent.stopPropagation(domEv);
                }
                onClickDistrict?.(name, feature);
            });

            layer.on("mouseover", () => {
                (layer as any).setStyle?.(styles.hover);
                (layer as any).bringToFront?.();
                hoveredRef.current = layer;
                scheduleUpdate();
            });

            layer.on("mouseout", () => {
                (layer as any).setStyle?.(styles.base);
                hoveredRef.current = null;
                scheduleUpdate();
            });

            scheduleUpdate();
        },
        [onClickDistrict, styles.base, styles.hover, scheduleUpdate]
    );

    if (!data) return null;

    return (
        <GeoJSON
            data={data}
            style={styles.base}
            onEachFeature={onEachFeature}
            ref={(v: any) => {
                geoRef.current = v ? ((v as any).leafletElement ?? v) : null;
                scheduleUpdate();
            }}
        />
    );
}