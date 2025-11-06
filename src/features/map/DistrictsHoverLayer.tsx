import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";

type Props = {
    data: any;
    onClickDistrict?: (name: string | undefined, feature: any) => void;
};

export default function DistrictsHoverLayer({ data, onClickDistrict }: Props) {

    // Cores do tema
    const cs = getComputedStyle(document.documentElement);
    const borderColor = cs.getPropertyValue("--bg-panel").trim()   || "#122b1a";
    const fillColor   = cs.getPropertyValue("--border").trim()     || "#254b32";
    const fillHover   = cs.getPropertyValue("--border-2").trim()   || "#2d593b";
    const hoverBorder = cs.getPropertyValue("--gold-dark").trim()  || "#b38f3b";

    const baseStyle: L.PathOptions = {
        color: borderColor,
        weight: 1.6,
        fillColor,
        fillOpacity: 1,
    };

    function onEachFeature(feature: any, layer: L.Path) {
        const name =
            feature?.properties?.name ||
            feature?.properties?.NAME ||
            feature?.properties?.["name:pt"];

        // guardar estilo original para reset
        (layer as any)._origStyle = { ...baseStyle };

        layer.on("click", () => onClickDistrict?.(name, feature));

        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
            e.target.setStyle({
                weight: 2.2,
                color: hoverBorder,
                fillColor: fillHover,
                fillOpacity: 0.6, // menos opaco no hover
            });
            e.target.bringToFront();

            if (name) {
                // tooltip que segue o cursor (sticky)
                (layer as any).bindTooltip(name, {
                    className: "district-badge",
                    direction: "top",
                    sticky: true,     // <— segue o cursor automaticamente
                    opacity: 1,
                    offset: [0, -10],
                    permanent: false,
                });
                (layer as any).openTooltip(e.latlng);
            }
        });

        layer.on("mouseout", (e: L.LeafletMouseEvent) => {
            const orig = (layer as any)._origStyle as L.PathOptions | undefined;
            if (orig) e.target.setStyle(orig);
            e.target.bringToBack();

            // remove/fecha a tooltip ligada a este layer
            if ((layer as any).isTooltipOpen?.()) {
                (layer as any).closeTooltip();
            }
            (layer as any).unbindTooltip?.();
        });
    }

    return <GeoJSON data={data} style={baseStyle} onEachFeature={onEachFeature} />;
}