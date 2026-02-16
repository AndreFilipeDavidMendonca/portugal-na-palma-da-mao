// src/lib/districtInfo.ts
import { fetchDistrictById, type DistrictDto } from "@/lib/api";

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

/** Fonte única da verdade: distrito por ID. */
export async function fetchDistrictInfoById(
    id: number
): Promise<DistrictInfo | null> {
    try {
        const dto = await fetchDistrictById(id);
        return dto ? fromDto(dto) : null;
    } catch (e) {
        console.error("[districtInfo] erro a carregar distrito por id:", e);
        return null;
    }
}