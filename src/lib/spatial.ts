// src/lib/spatial.ts
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

type AnyGeo = any;

export function isPointInside(featurePoint: AnyGeo, areaFeature: AnyGeo): boolean {
    const coords = featurePoint?.geometry?.coordinates;
    if (!coords || featurePoint?.geometry?.type !== "Point") return false;

    if (!areaFeature) return false;

    try {
        // coords já vêm em [lon, lat]
        const p = point(coords as [number, number]);
        return booleanPointInPolygon(p, areaFeature as any);
    } catch {
        return false;
    }
}

export function filterPointsInsideDistrict(allPoints: AnyGeo | null, districtFeature: AnyGeo | null): AnyGeo {
    // ✅ nunca devolver null
    if (!allPoints) return { type: "FeatureCollection", features: [] as any[] };

    // ✅ se não houver distrito, não filtra
    if (!districtFeature) return allPoints;

    const feats = allPoints.features ?? [];
    return {
        type: "FeatureCollection",
        features: feats.filter((f: any) => isPointInside(f, districtFeature)),
    };
}