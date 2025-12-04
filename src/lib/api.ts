// src/lib/api.ts

export const API_BASE =
    import.meta.env.VITE_API_BASE ?? "http://localhost:8085";

/* ========= POIs ========= */

export type PoiDto = {
    id: number;
    districtId: number | null;
    name: string;
    namePt: string | null;
    category: string | null;
    subcategory: string | null;
    description: string | null;
    lat: number;
    lon: number;
    wikipediaUrl: string | null;
    sipaId: string | null;
    externalOsmId: string | null;
    source: string | null;
    image: string | null;
    images: string[] | null;
};

export async function fetchPois(): Promise<PoiDto[]> {
    const res = await fetch(`${API_BASE}/api/pois`);
    if (!res.ok) throw new Error("Falha a carregar POIs");
    return res.json();
}

export async function fetchPoiById(id: number): Promise<PoiDto> {
    const res = await fetch(`${API_BASE}/api/pois/${id}`);
    if (!res.ok) throw new Error("Falha a carregar POI");
    return res.json();
}

export type PoiUpdatePayload = {
    name?: string | null;
    namePt?: string | null;
    description?: string | null;
    image?: string | null;
    images?: string[] | null;
};

export async function updatePoi(
    id: number,
    body: PoiUpdatePayload
): Promise<PoiDto> {
    const res = await fetch(`${API_BASE}/api/pois/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`Falha ao atualizar POI (status ${res.status})`);
    }
    return res.json();
}

/* ========= Distritos ========= */

export type DistrictDto = {
    id: number;
    code: string;
    name: string;
    namePt: string | null;
    population: number | null;
    foundedYear: number | null;
    lat: number | null;
    lon: number | null;
    description: string | null;
    inhabitedSince: string | null;
    history: string | null;
    municipalitiesCount: number | null;
    parishesCount: number | null;

    // aqui guardamos as URLs ("/api/districts/{id}/files/{fileId}")
    files: string[];
};

export async function fetchDistricts(): Promise<DistrictDto[]> {
    const res = await fetch(`${API_BASE}/api/districts`);
    if (!res.ok) throw new Error("Falha a carregar distritos");
    return res.json();
}

export type DistrictUpdatePayload = {
    name?: string | null;
    namePt?: string | null;
    population?: number | null;
    description?: string | null;
    history?: string | null;
    inhabitedSince?: string | null;
    municipalitiesCount?: number | null;
    parishesCount?: number | null;
    files?: string[] | null;
};

export async function updateDistrict(
    id: number,
    body: DistrictUpdatePayload
): Promise<DistrictDto> {
    const res = await fetch(`${API_BASE}/api/districts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`Falha ao atualizar distrito (status ${res.status})`);
    }
    return res.json();
}

/* ========= Ficheiros de distrito ========= */

export type DistrictFileDto = {
    id: number;
    districtId: number;
    fileName: string;
    contentType: string;
    url: string;            // /api/districts/{districtId}/files/{id}
    base64Content?: string; // opcional, caso o backend envie
};

export async function uploadDistrictFiles(
    districtId: number,
    files: File[]
): Promise<DistrictFileDto[]> {
    const formData = new FormData();
    for (const f of files) {
        formData.append("files", f);
    }

    const res = await fetch(`${API_BASE}/api/districts/${districtId}/files`, {
        method: "POST",
        body: formData, // NÃO pôr Content-Type, o browser trata disso
    });

    if (!res.ok) {
        throw new Error(
            `Falha ao fazer upload de ficheiros (status ${res.status})`
        );
    }

    return res.json();
}

export async function fetchDistrictById(id: number): Promise<DistrictDto> {
    const res = await fetch(`${API_BASE}/api/districts/${id}`);
    if (!res.ok) {
        throw new Error(`Falha a carregar distrito (status ${res.status})`);
    }
    return res.json();
}