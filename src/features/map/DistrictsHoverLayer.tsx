import { GeoJSON } from "react-leaflet";
import L from "leaflet";

type Props = {
    data: any;
    onClickDistrict?: (name: string | undefined, feature: any) => void;
};

export default function DistrictsHoverLayer({ data, onClickDistrict }: Props) {
    const cs = getComputedStyle(document.documentElement);

    const borderColor = cs.getPropertyValue("--bg-panel").trim() || "#122b1a";
    const fillColor = cs.getPropertyValue("--border").trim() || "#254b32";
    const fillHover = cs.getPropertyValue("--border-2").trim() || "#2d593b";
    const hoverBorder = cs.getPropertyValue("--gold-dark").trim() || "#b38f3b";

    const baseStyle: L.PathOptions = {
        color: borderColor,
        weight: 1.6,
        fillColor,
        fillOpacity: 1,
    };

    const hoverStyle: L.PathOptions = {
        weight: 2.2,
        color: hoverBorder,
        fillColor: fillHover,
        fillOpacity: 0.6,
    };

    const getName = (f: any): string | undefined =>
        f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"] || undefined;

    function onEachFeature(feature: any, layer: L.Path) {
        const name = getName(feature);

        // bind tooltip uma vez, nunca unbind (evita _tooltip undefined)
        if (name) {
            (layer as any).bindTooltip(name, {
                className: "district-badge",
                direction: "top",
                sticky: true,
                opacity: 1,
                offset: [0, -10],
            });
        }

        let last = 0;

        const fire = (e: any) => {
            const now = Date.now();
            if (now - last < 250) return;
            last = now;

            const domEv = e?.originalEvent;
            if (domEv) {
                L.DomEvent.preventDefault(domEv);
                L.DomEvent.stopPropagation(domEv);
            }

            const f = e?.target?.feature ?? feature;
            onClickDistrict?.(getName(f), f);
        };

        // Chrome: mousedown é mais fiável em Path (e mantém click/touch como fallback)
        layer.on("mousedown", fire);
        layer.on("click", fire);
        layer.on("touchstart", fire);

        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
            (e.target as any).setStyle(hoverStyle);
            (e.target as any).bringToFront?.();
        });

        layer.on("mouseout", (e: L.LeafletMouseEvent) => {
            (e.target as any).setStyle(baseStyle);

            // fechar tooltip sem isTooltipOpen (evita crash em algumas versões)
            const tt = (layer as any).getTooltip?.();
            if (tt) (layer as any).closeTooltip();
        });
    }

    return <GeoJSON data={data} style={baseStyle} onEachFeature={onEachFeature} />;
}