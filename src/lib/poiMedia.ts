// src/lib/poiMedia.ts
import { getDistrictMedia10, getPoiMedia10 } from "@/lib/wikimedia";

/**
 * ✅ Feature flag TEMPORÁRIA
 * Quando tiveres as fotos sempre na BD:
 * - mete false (ou apaga este ficheiro e chama direto da API)
 */
export const WIKI_MEDIA_ENABLED = true;

const uniqStrings = (arr: string[]): string[] => Array.from(new Set((arr ?? []).filter(Boolean)));

export function isBusinessPoi(input: any): boolean {
    // aceita feature (properties) ou dto/base
    const p = input?.properties ?? input ?? {};
    const cat = p.category ?? null;
    const src = p.source ?? null;
    return cat === "business" || src === "business";
}

export function shouldUseWikiImages(input: any): boolean {
    if (!WIKI_MEDIA_ENABLED) return false;
    if (isBusinessPoi(input)) return false; // ✅ comerciais nunca chamam
    return true;
}

/**
 * ✅ Resolve media de POI até 10 (BD + opcional wiki)
 * - Comerciais: nunca usa wiki
 * - Futuro: WIKI_MEDIA_ENABLED=false e fica só BD
 */
export async function resolvePoiMedia10(args: {
    label: string;
    baseImage?: string | null;
    baseImages?: string[] | null;
    allowWikiFor?: any; // feature/dto
    limit?: number;
}): Promise<string[]> {
    const limit = args.limit ?? 10;

    const base = uniqStrings([args.baseImage ?? "", ...(args.baseImages ?? [])]).slice(0, limit);

    if (!args.label?.trim()) return base;
    if (!shouldUseWikiImages(args.allowWikiFor)) return base;

    // getPoiMedia10 deve respeitar base e devolver no máximo limit
    return getPoiMedia10(args.label, base, limit);
}

/**
 * ✅ Resolve media de District até 10 (BD + opcional wiki)
 * - Futuro: WIKI_MEDIA_ENABLED=false e fica só BD
 */
export async function resolveDistrictMedia10(args: {
    name: string;
    baseUrls?: string[] | null;
    allowWiki?: boolean;
    limit?: number;
}): Promise<string[]> {
    const limit = args.limit ?? 10;
    const base = uniqStrings(args.baseUrls ?? []).slice(0, limit);

    if (!args.name?.trim()) return base;
    if (!WIKI_MEDIA_ENABLED) return base;
    if (args.allowWiki === false) return base;

    return getDistrictMedia10(args.name, base, limit);
}