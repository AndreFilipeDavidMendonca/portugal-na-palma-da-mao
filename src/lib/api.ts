export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8085";

/* ========= helpers ========= */
async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init);

    if (res.status === 204) return null as unknown as T;

    const text = await res.text();
    let data: any;

    // evita crash se vier HTML/texto
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text || null;
    }

    if (!res.ok) {
        const msg =
            (data && typeof data === "object" && (data.message || data.error)) ||
            (typeof data === "string" && data) ||
            `Erro HTTP ${res.status}`;
        throw new Error(msg);
    }

    return data as T;
}

/* ========= Auth / Utilizador atual ========= */
export type CurrentUserDto = {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string; // "ADMIN" | "USER"
};

/** Guest => null (não lança erro) */
export async function fetchCurrentUser(): Promise<CurrentUserDto | null> {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });

    if (res.status === 401) return null;

    if (!res.ok) {
        throw new Error(`Falha a carregar utilizador atual (status ${res.status})`);
    }

    return res.json();
}

/** Backend espera x-www-form-urlencoded */
export async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) throw new Error(`Login falhou (status ${res.status})`);
    return res.json(); // ou fetchCurrentUser() se preferires
}

export async function logout(): Promise<void> {
    await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        credentials: "include",
    });
}

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
    return jsonFetch<PoiDto[]>(`${API_BASE}/api/pois`);
}

export async function fetchPoiById(id: number): Promise<PoiDto> {
    return jsonFetch<PoiDto>(`${API_BASE}/api/pois/${id}`);
}

export type PoiUpdatePayload = {
    name?: string | null;
    namePt?: string | null;
    description?: string | null;
    image?: string | null;
    images?: string[] | null;
};

export async function updatePoi(id: number, body: PoiUpdatePayload): Promise<PoiDto> {
    return jsonFetch<PoiDto>(`${API_BASE}/api/pois/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });
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
    files: string[];
};

export async function fetchDistricts(): Promise<DistrictDto[]> {
    return jsonFetch<DistrictDto[]>(`${API_BASE}/api/districts`);
}

export async function fetchDistrictById(id: number): Promise<DistrictDto> {
    return jsonFetch<DistrictDto>(`${API_BASE}/api/districts/${id}`);
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

export async function updateDistrict(id: number, body: DistrictUpdatePayload): Promise<DistrictDto> {
    return jsonFetch<DistrictDto>(`${API_BASE}/api/districts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
    });
}