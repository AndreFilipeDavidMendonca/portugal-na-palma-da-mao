// src/lib/poiMedia.ts
import { getDistrictMedia10, getPoiMedia10 } from "@/lib/wikimedia";

/**
 * ✅ Feature flag TEMPORÁRIA
 * Quando tiveres as fotos sempre na BD:
 * - mete false (ou apaga este ficheiro e chama direto da API)
 */
export const WIKI_MEDIA_ENABLED = true;

const uniqStrings = (arr: string[]): string[] =>
    Array.from(new Set((arr ?? []).filter(Boolean)));

function norm(v: any): string {
    return (v == null ? "" : String(v)).trim().toLowerCase();
}

export function isBusinessPoi(input: any): boolean {
    // aceita feature (properties) ou dto/base
    const p = input?.properties ?? input ?? {};
    const cat = norm(p.category);
    const src = norm(p.source);

    // ✅ aceita alguns aliases comuns (ajusta se necessário)
    const isBizCat =
        cat === "business" ||
        cat === "commercial" ||
        cat === "comercial" ||
        cat === "biz";

    const isBizSrc =
        src === "business" ||
        src === "commercial" ||
        src === "comercial" ||
        src === "biz";

    return isBizCat || isBizSrc;
}

export function shouldUseWikiImages(input: any): boolean {
    if (!WIKI_MEDIA_ENABLED) return false;
    if (isBusinessPoi(input)) return false; // ✅ comerciais nunca chamam
    return true;
}

export async function resolvePoiMedia10(args: {
    label: string;
    baseImage?: string | null;
    baseImages?: string[] | null;
    allowWikiFor?: any; // feature/dto
    limit?: number;
}): Promise<string[]> {
    const max = args.limit ?? 10;

    const base = uniqStrings([
        args.baseImage ?? "",
        ...(args.baseImages ?? []),
    ]).slice(0, max);

    if (!args.label?.trim()) return base;
    if (!shouldUseWikiImages(args.allowWikiFor)) return base;

    // getPoiMedia10 deve respeitar base e devolver no máximo max
    const merged = await getPoiMedia10(args.label, base, max);

    // ✅ garante hard-cap e unicidade (caso a impl wiki "exagere")
    return uniqStrings(merged).slice(0, max);
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
    const max = args.limit ?? 10;
    const base = uniqStrings(args.baseUrls ?? []).slice(0, max);

    if (!args.name?.trim()) return base;
    if (!WIKI_MEDIA_ENABLED) return base;
    if (args.allowWiki === false) return base;

    const merged = await getDistrictMedia10(args.name, base, max);
    return uniqStrings(merged).slice(0, max);
}