// src/pages/district/hooks/useDistrictPois.ts
import { useMemo } from "react";
import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import {normalizeCat} from "@/utils/poiCategory";

type AnyGeo = any;

export function useDistrictPois(poiPoints: AnyGeo | null, selectedTypes: Set<PoiCategory>) {
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };

                const name = props["name:pt"] || props.name || props["name:en"] || props.label || null;
                if (!name || typeof name !== "string" || name.trim() === "") return null;

                const nf = { ...f, properties: { ...props } as any };

                const cat = normalizeCat(props.category as unknown);
                if (cat) {
                    (nf.properties as any).__cat = cat;
                    (nf.properties as any).category = cat; // opcional mas útil
                }

                return nf;
            })
            .filter(Boolean);

        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    const countsByCat = useMemo<Record<PoiCategory, number>>(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        for (const f of normalizedPoints?.features ?? []) {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalizedPoints]);

    const filteredPoints = useMemo(() => {
        if (!normalizedPoints) return null;
        if (!selectedTypes || selectedTypes.size === 0) return normalizedPoints;

        const feats = normalizedPoints.features.filter((f: any) => {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            return cat ? selectedTypes.has(cat) : false;
        });

        return { ...normalizedPoints, features: feats };
    }, [normalizedPoints, selectedTypes]);

    return { normalizedPoints, countsByCat, filteredPoints };
}