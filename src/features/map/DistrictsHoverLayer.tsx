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
            fillOpacity: 0.6, // ✅ a transparência do hover
        }),
        [hoverBorder, fillHover]
    );

    const getName = (f: any): string | undefined =>
        f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"] || undefined;

    // 🔒 “estado global” do hover em mobile
    const activeKeyRef = useRef<string | number | null>(null);
    const activeLayerRef = useRef<L.Path | null>(null);

    // 👮 guard para não limpar no mesmo tap (map click logo a seguir)
    const suppressMapClearUntilRef = useRef<number>(0);

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

    // ✅ no mobile: tocar no mapa (fora) limpa
    useEffect(() => {
        const onMapClick = () => {
            if (!isMobileViewport()) return;

            // se acabámos de tocar num distrito, não limpar já
            if (Date.now() < suppressMapClearUntilRef.current) return;

            clearActive();
        };

        map.on("click", onMapClick);
        return () => {
            map.off("click", onMapClick);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, baseStyle]);

    function onEachFeature(feature: any, layer: L.Path) {
        const name = getName(feature);

        if (name) {
            (layer as any).bindTooltip(name, {
                className: "district-badge",
                direction: "top",
                sticky: !isMobileViewport(), // desktop segue cursor; mobile “fixo”
                opacity: 1,
                offset: [0, -10],
            });
        }

        const key: string | number =
            feature?.properties?.id ??
            feature?.properties?.NAME ??
            feature?.properties?.name ??
            feature?.properties?.["name:pt"] ??
            name ??
            Math.random();

        const openDistrict = (e?: any) => {
            const f = (e?.target as any)?.feature ?? feature;
            onClickDistrict?.(getName(f), f);
        };

        const applyHover = (e?: any) => {
            // fecha o anterior se for outro
            if (activeKeyRef.current != null && activeKeyRef.current !== key) clearActive();

            (layer as any).setStyle?.(hoverStyle);
            (layer as any).bringToFront?.();

            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).openTooltip?.();

            activeKeyRef.current = key;
            activeLayerRef.current = layer;

            // impede o map click de fechar no mesmo tap
            suppressMapClearUntilRef.current = Date.now() + 250;

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
        // Desktop hover
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
        // Desktop click abre
        // -------------------
        layer.on("click", (e: any) => {
            if (isMobileViewport()) return;
            openDistrict(e);
        });

        // -------------------
        // Mobile: 1º toque = hover, 2º toque = abre
        // -------------------
        const onMobileTap = (e: any) => {
            if (!isMobileViewport()) return;

            // 1º toque: hover
            if (activeKeyRef.current !== key) {
                applyHover(e);
                return;
            }

            // 2º toque: abre
            const domEv = e?.originalEvent;
            if (domEv) {
                L.DomEvent.preventDefault(domEv);
                L.DomEvent.stopPropagation(domEv);
            }
            openDistrict(e);
        };

        // iOS/Android mais fiável assim:
        layer.on("touchstart", onMobileTap);
        layer.on("mousedown", onMobileTap); // Android/Chrome às vezes prefere mousedown
    }

    return <GeoJSON data={data} style={baseStyle} onEachFeature={onEachFeature} />;
}