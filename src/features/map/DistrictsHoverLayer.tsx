import { GeoJSON, useMap } from "react-leaflet";
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";

type Props = {
    data: any;
    onClickDistrict?: (name: string | undefined, feature: any) => void;
};

function isMobileViewport() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
}

export default function DistrictsHoverLayer({ data, onClickDistrict }: Props) {
    const map = useMap();

    const cs = getComputedStyle(document.documentElement);

    const borderColor = cs.getPropertyValue("--bg-panel").trim() || "#122b1a";
    const fillColor = cs.getPropertyValue("--border").trim() || "#254b32";
    const fillHover = cs.getPropertyValue("--border-2").trim() || "#2d593b";
    const hoverBorder = cs.getPropertyValue("--gold-dark").trim() || "#b38f3b";

    const baseStyle: L.PathOptions = useMemo(
        () => ({
            color: borderColor,
            weight: 1.6,
            fillColor,
            fillOpacity: 1,
        }),
        [borderColor, fillColor]
    );

    const hoverStyle: L.PathOptions = useMemo(
        () => ({
            weight: 2.2,
            color: hoverBorder,
            fillColor: fillHover,
            fillOpacity: 0.6, // ✅ transparência exacta do hover
        }),
        [hoverBorder, fillHover]
    );

    const getName = (f: any): string | undefined =>
        f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"] || undefined;

    // 🔒 estado global (1 distrito ativo no mobile)
    const activeKeyRef = useRef<string | number | null>(null);
    const activeLayerRef = useRef<L.Path | null>(null);

    const clearActive = () => {
        const layer = activeLayerRef.current;
        if (layer) {
            (layer as any).setStyle?.(baseStyle);
            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).closeTooltip?.();
        }
        activeLayerRef.current = null;
        activeKeyRef.current = null;
    };

    // ✅ no mobile: tocar fora limpa hover/tooltip
    useEffect(() => {
        const onMapPointerDown = () => {
            if (!isMobileViewport()) return;
            clearActive();
        };

        map.on("pointerdown", onMapPointerDown);
        return () => {
            map.off("pointerdown", onMapPointerDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, baseStyle]);

    function onEachFeature(feature: any, layer: L.Path) {
        const name = getName(feature);

        // bind tooltip 1x
        if (name) {
            (layer as any).bindTooltip(name, {
                className: "district-badge",
                direction: "top",
                sticky: !isMobileViewport(), // desktop segue cursor; mobile fica “fixa”
                opacity: 1,
                offset: [0, -10],
            });
        }

        const key: string | number =
            feature?.properties?.id ??
            feature?.properties?.NAME ??
            feature?.properties?.name ??
            feature?.properties?.["name:pt"] ??
            Math.random();

        const openDistrict = (e?: any) => {
            const f = (e?.target as any)?.feature ?? feature;
            onClickDistrict?.(getName(f), f);
        };

        const applyHover = (e?: any) => {
            // se havia outro ativo, limpa
            if (activeKeyRef.current != null && activeKeyRef.current !== key) clearActive();

            // ✅ aplica hover EXACTAMENTE como no desktop
            (layer as any).setStyle?.(hoverStyle);
            (layer as any).bringToFront?.();

            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).openTooltip?.();

            activeKeyRef.current = key;
            activeLayerRef.current = layer;

            const domEv = e?.originalEvent;
            if (domEv) {
                L.DomEvent.preventDefault(domEv);
                L.DomEvent.stopPropagation(domEv);
            }
        };

        const removeHover = () => {
            (layer as any).setStyle?.(baseStyle);
            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).closeTooltip?.();
        };

        // -------------------
        // Desktop hover real
        // -------------------
        layer.on("mouseover", () => {
            if (isMobileViewport()) return;
            (layer as any).setStyle?.(hoverStyle);
            (layer as any).bringToFront?.();
            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).openTooltip?.();
        });

        layer.on("mouseout", () => {
            if (isMobileViewport()) return;
            removeHover();
        });

        // -------------------
        // Mobile: 1º toque = hover, 2º toque = open
        // (usar pointerdown é mais fiável que click/touchstart)
        // -------------------
        layer.on("pointerdown", (e: any) => {
            if (!isMobileViewport()) return; // desktop usa click normal

            // 1º toque
            if (activeKeyRef.current !== key) {
                applyHover(e);
                return;
            }

            // 2º toque (mesmo distrito) -> abre
            const domEv = e?.originalEvent;
            if (domEv) {
                L.DomEvent.preventDefault(domEv);
                L.DomEvent.stopPropagation(domEv);
            }
            openDistrict(e);
        });

        // Desktop click abre
        layer.on("click", (e: any) => {
            if (isMobileViewport()) return;
            openDistrict(e);
        });
    }

    return <GeoJSON data={data} style={baseStyle} onEachFeature={onEachFeature} />;
}