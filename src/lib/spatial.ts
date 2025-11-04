// src/lib/spatial.ts
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

type AnyGeo = any;

export function isPointInside(featurePoint: AnyGeo, areaFeature: AnyGeo): boolean {
    const coords = featurePoint?.geometry?.coordinates;
    if (!coords || featurePoint?.geometry?.type !== "Point") return false;

    const polyGeom = areaFeature?.geometry;
    if (!polyGeom) return false;

    const p = point(coords as [number, number]);

    try {
        // aceita Polygon/MultiPolygon/Feature<Polygon|MultiPolygon>
        return booleanPointInPolygon(p, areaFeature as any);
    } catch {
        return false;
    }
}

export function filterPointsInsideDistrict(
    allPoints: AnyGeo | null,           // FeatureCollection
    districtFeature: AnyGeo | null      // Feature (Polygon|MultiPolygon)
): AnyGeo | null {
    if (!allPoints || !districtFeature) return null;
    const out = { type: "FeatureCollection", features: [] as any[] };
    for (const f of allPoints.features || []) {
        if (isPointInside(f, districtFeature)) out.features.push(f);
    }
    return out;
}