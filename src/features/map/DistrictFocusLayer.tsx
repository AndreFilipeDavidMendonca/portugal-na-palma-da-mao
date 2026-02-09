// src/features/map/DistrictFocusLayer.tsx
import { GeoJSON, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";

export default function DistrictFocusLayer({ feature }: { feature: any }) {
    const map = useMap();

    const style = useMemo<L.PathOptions>(() => {
        const root = getComputedStyle(document.documentElement);
        const borderColor = root.getPropertyValue("--gold-dark").trim() || "#b38f3b";
        const fillHover = root.getPropertyValue("--border-2").trim() || "#2d593b";
        return { color: borderColor, weight: 2.3, fillColor: fillHover, fillOpacity: 0.72 };
    }, []);

    useEffect(() => {
        if (!feature) return;
        const b = L.geoJSON(feature).getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08), { animate: false });
    }, [feature, map]);

    if (!feature) return null;
    return <GeoJSON data={feature} style={style} interactive={false} />;
}