// src/pages/district/utils/poiMedia.ts
export const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

export const mergeMedia = (base: string[], extra: string[], limit = 10) =>
    uniqStrings([...base, ...extra]).slice(0, limit);

export function pickPoiLabel(feature: any): string | null {
    const p = feature?.properties ?? {};
    const label = p.namePt ?? p["name:pt"] ?? p.name ?? p["name:en"] ?? p.label ?? null;
    return typeof label === "string" && label.trim().length >= 3 ? label.trim() : null;
}

export function pickPoiId(feature: any): number | null {
    const id = feature?.properties?.id;
    return typeof id === "number" ? id : null;
}