// src/lib/api.ts
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8085";

/* =========================
   Helpers
========================= */

async function parseJsonSafe(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function extractErrorMessage(data: any, status: number) {
    return (
        (data && typeof data === "object" && (data.message || data.error)) ||
        (typeof data === "string" && data) ||
        `Erro HTTP ${status}`
    );
}

/** Fetch JSON (ou texto) e lança erro se !ok */
async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, init);

    if (res.status === 204) return null as unknown as T;

    const data = await parseJsonSafe(res);

    if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.status));
    }

    return data as T;
}

/* =========================
   Auth
========================= */

export type RegisterPayload = {
    firstName?: string | null;
    lastName?: string | null;
    age?: number | null;
    nationality?: string | null;
    email: string;
    phone?: string | null;
    password: string;
};

export type CurrentUserDto = {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;

    firstName?: string | null;
    lastName?: string | null;
    age?: number | null;
    nationality?: string | null;
    phone?: string | null;
};

export async function register(body: RegisterPayload): Promise<CurrentUserDto> {
    const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
            firstName: body.firstName ?? null,
            lastName: body.lastName ?? null,
            age: body.age ?? null,
            nationality: body.nationality ?? null,
            email: body.email.trim(),
            phone: body.phone ?? null,
            password: body.password,
        }),
    });

    if (res.status === 409) throw new Error("Já existe uma conta com esse email.");
    if (!res.ok) throw new Error(`Registo falhou (status ${res.status})`);

    return res.json();
}

/** Guest => null */
export async function fetchCurrentUser(): Promise<CurrentUserDto | null> {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Falha a carregar utilizador atual (status ${res.status})`);
    return res.json();
}

export async function login(email: string, password: string): Promise<CurrentUserDto> {
    return jsonFetch<CurrentUserDto>(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
    });
}

export async function logout(): Promise<void> {
    await fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" });
}

/* =========================
   POIs
========================= */

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

/* =========================
   Distritos
========================= */

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

/* =========================
   Favorites
========================= */

export type FavoriteDto = {
    poiId: number;
    name: string;
    image: string | null;
    createdAt: string; // Instant
};

export async function fetchFavorites(): Promise<FavoriteDto[]> {
    return jsonFetch<FavoriteDto[]>(`${API_BASE}/api/favorites`, { credentials: "include" });
}

/**
 * Status do favorito (POI):
 * - null => não autenticado (ou endpoint não disponível / 404)
 * - { favorited: true/false } => autenticado
 */
export async function fetchFavoriteStatus(
    poiId: number
): Promise<{ favorited: boolean } | null> {
    const res = await fetch(`${API_BASE}/api/favorites/${poiId}`, {
        credentials: "include",
    });

    if (res.status === 401) return null;
    if (res.status === 204) return { favorited: true };
    if (res.status === 404) return { favorited: false };

    const text = await res.text();
    let data: any;

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

    // ✅ backend atual: { favorite: true }
    if (data && typeof data.favorite === "boolean") {
        return { favorited: data.favorite };
    }

    // compat: { favorited: true }
    if (data && typeof data.favorited === "boolean") {
        return { favorited: data.favorited };
    }

    // fallback seguro
    return { favorited: false };
}

export async function addFavorite(
    poiId: number,
    payload?: { name?: string | null; image?: string | null }
): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/favorites/${poiId}`, {
        method: "POST",
        credentials: "include",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
    });
}

export async function removeFavorite(poiId: number): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/favorites/${poiId}`, {
        method: "DELETE",
        credentials: "include",
    });
}