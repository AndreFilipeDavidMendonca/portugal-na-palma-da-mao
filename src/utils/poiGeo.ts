// src/pages/home/utils/poiGeo.ts
import type { PoiCategory } from "@/utils/constants";
import type { PoiDto } from "@/lib/api";

type AnyGeo = any;

export function pickPoiLabelFromDto(p: PoiDto): string {
    return (p.namePt ?? p.name ?? "").trim();
}

export function normalizeCategory(p: PoiDto): PoiCategory | string | null {
    // aqui NÃO mexes em source. category já vem "gastronomy", etc.
    return p.category ?? null;
}

export function poiDtoToFeature(p: PoiDto): any {
    const category = normalizeCategory(p);

    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
            id: p.id,
            poiId: p.id,
            districtId: p.districtId ?? null,
            ownerId: p.ownerId ?? null,

            name: p.name,
            namePt: p.namePt ?? p.name,

            category,
            subcategory: p.subcategory ?? null,

            description: p.description ?? null,
            wikipediaUrl: p.wikipediaUrl ?? null,
            sipaId: p.sipaId ?? null,
            externalOsmId: p.externalOsmId ?? null,
            source: p.source ?? null,

            image: p.image ?? null,
            images: p.images ?? [],

            historic: category || "poi",
            tags: { category, subcategory: p.subcategory ?? null },
        },
    };
}

export function poiDtosToGeoJSON(pois: PoiDto[]): AnyGeo {
    return { type: "FeatureCollection", features: (pois ?? []).map(poiDtoToFeature) };
}

export const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));