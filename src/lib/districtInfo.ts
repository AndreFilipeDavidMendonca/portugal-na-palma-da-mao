// src/lib/districtInfo.ts
export type DistrictInfo = {
    inhabited_since?: string;
    description?: string;
    history?: string;
    parishes?: number | null;
    photos?: string[];
    sources?: { label: string; url: string }[];
};

type DistrictsMap = Record<string, DistrictInfo>;

// util: normaliza a chave "Lisboa" => "lisboa"
const norm = (s: string) =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

let cache: DistrictsMap | null = null;

export async function fetchDistrictInfo(name: string): Promise<DistrictInfo | null> {
    try {
        if (!cache) {
            const data = await import("@/data/districts.json");
            cache = data.default as DistrictsMap;

            // cria um índice normalizado para lookup mais robusto
            const ncache: DistrictsMap = {};
            for (const [k, v] of Object.entries(cache)) {
                ncache[norm(k)] = v;
            }
            cache = ncache;
        }
        return cache[norm(name)] ?? null;
    } catch (e) {
        console.error("[districtInfo] erro a carregar districts.json:", e);
        return null;
    }
}