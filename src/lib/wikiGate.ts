import type { PoiCategory } from "@/utils/constants";
import { isCommercialCategory } from "@/utils/poiCategory";
import { searchWikimediaImagesByName } from "@/lib/wikimedia";

export async function searchWikimediaIfAllowed(
    label: string,
    limit: number,
    category: PoiCategory | null | undefined
): Promise<string[]> {
    const name = (label ?? "").trim();
    if (!name) return [];

    const cat = category ?? null;
    if (isCommercialCategory(cat)) return []; // ✅ nunca para comerciais

    try {
        return (await searchWikimediaImagesByName(name, limit)) ?? [];
    } catch {
        return [];
    }
}