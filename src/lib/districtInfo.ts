// src/lib/districtInfo.ts

import { fetchDistricts, type DistrictDto } from "@/lib/api";

export type DistrictInfo = {
    id: number;
    code: string;
    name: string;
    namePt: string | null;
    population: number | null;
    municipalities: number | null;
    parishes: number | null;
    inhabited_since: string | null;
    description: string | null;
    history: string | null;
    files: string[];
};

type DistrictsMap = Record<string, DistrictInfo>;

// normaliza: "Lisboa" / "distrito de lisboa" → "lisboa"
const norm = (s: string) =>
    (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^\s*distrito\s+de\s+/i, "")
        .trim()
        .toLowerCase();

let cache: DistrictsMap | null = null;

function fromDto(dto: DistrictDto): DistrictInfo {
    return {
        id: dto.id,
        code: dto.code,
        name: dto.name,
        namePt: dto.namePt,
        population: dto.population,
        municipalities: dto.municipalitiesCount,
        parishes: dto.parishesCount,
        inhabited_since: dto.inhabitedSince,
        description: dto.description,
        history: dto.history,
        files: dto.files ?? [],
    };
}

/**
 * Devolve info de um distrito a partir do nome vindo do GeoJSON
 * (districtFeature.properties.name).
 *
 * Faz 1 chamada à API /api/districts e depois usa cache em memória.
 */
export async function fetchDistrictInfo(name: string): Promise<DistrictInfo | null> {
    try {
        if (!cache) {
            const districts = await fetchDistricts();
            const map: DistrictsMap = {};

            for (const d of districts) {
                const info = fromDto(d);

                // index por name
                if (d.name) {
                    map[norm(d.name)] = info;
                }
                // index também por namePt se existir
                if (d.namePt) {
                    map[norm(d.namePt)] = info;
                }
            }

            cache = map;
        }

        const key = norm(name);
        return cache[key] ?? null;
    } catch (e) {
        console.error("[districtInfo] erro a carregar distritos da API:", e);
        return null;
    }
}