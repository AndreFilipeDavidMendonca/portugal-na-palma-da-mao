// src/utils/poiCategory.ts
import type { PoiCategory } from "@/utils/constants";
import { POI_LABELS } from "@/utils/constants";

const COMMERCIAL_MAP_PT: Record<string, PoiCategory> = {
    gastronomia: "gastronomy",
    artesanato: "crafts",
    alojamento: "accommodation",
    evento: "event",
};

export const isPoiCategory = (val: any): val is PoiCategory =>
    val != null && Object.prototype.hasOwnProperty.call(POI_LABELS, val);

export const isCommercialCategory = (c: PoiCategory | null | undefined) =>
    c === "gastronomy" || c === "crafts" || c === "accommodation" || c === "event";

export function normalizeCat(raw: unknown): PoiCategory | null {
    if (typeof raw !== "string") return null;

    const s = raw.trim();
    if (!s) return null;

    // 1) já vem no formato interno
    if (isPoiCategory(s)) return s;

    // 2) tenta case-insensitive para keys internas (se alguém meter "Gastronomy")
    const sLower = s.toLowerCase();
    if (isPoiCategory(sLower)) return sLower as PoiCategory;

    // 3) map PT → internal
    return COMMERCIAL_MAP_PT[sLower] ?? null;
}