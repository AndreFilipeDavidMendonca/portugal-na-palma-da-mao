// src/features/map/DistrictFocusLayer.tsx
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

export default function DistrictFocusLayer({ feature }: { feature: any }) {
    const map = useMap();

    // mesmas cores/vars que o hover
    const root = getComputedStyle(document.documentElement);
    const borderColor = root.getPropertyValue("--gold-dark").trim() || "#b38f3b";
    const fillHover = root.getPropertyValue("--border-2").trim() || "#2d593b";
    const FILL_OPACITY_HOVER = 0.72; // igual ao hover

    useEffect(() => {
        if (!feature) return;
        const gj = L.geoJSON(feature as any);
        const b = gj.getBounds();
        if (b.isValid()) {
            map.fitBounds(b.pad(0.08), { animate: false });
        }
    }, [feature, map]);

    if (!feature) return null;

    const style: L.PathOptions = {
        color: borderColor,
        weight: 2.3,
        fillColor: fillHover,
        fillOpacity: FILL_OPACITY_HOVER,
    };

    return <GeoJSON data={feature as any} style={style} interactive={false} />;
}