// src/lib/api.ts
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/authToken";

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

/** Fetch base com Bearer token. Limpa token se 401. */
async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
    const token = getAuthToken();
    const headers = new Headers(init.headers ?? {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, {
        ...init,
        headers,
        credentials: "omit",
    });
}

/** Fetch JSON (ou texto) e lança erro se !ok */
async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await apiFetch(input, init);

    if (res.status === 204) return null as unknown as T;

    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(extractErrorMessage(data, res.status));

    return data as T;
}

/** Quando precisas do status + payload */
async function jsonFetchRaw<T>(
    input: RequestInfo,
    init?: RequestInit
): Promise<{ res: Response; data: T | null }> {
    const res = await apiFetch(input, init);
    if (res.status === 204) return { res, data: null };
    const data = (await parseJsonSafe(res)) as T;
    return { res, data };
}

/* =========================
   Auth
========================= */

export type RegisterRole = "USER" | "BUSINESS";

export type RegisterPayload = {
    role: RegisterRole;
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

export type AuthResponse = {
    token: string;
    user: CurrentUserDto;
};

export async function register(body: RegisterPayload): Promise<CurrentUserDto> {
    const { res, data } = await jsonFetchRaw<AuthResponse>(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            role: body.role,
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
    if (!res.ok) throw new Error(extractErrorMessage(data, res.status));

    const payload = data as AuthResponse;
    setAuthToken(payload.token);
    return payload.user;
}

export async function login(email: string, password: string): Promise<CurrentUserDto> {
    const payload = await jsonFetch<AuthResponse>(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
    });

    setAuthToken(payload.token);
    return payload.user;
}

export async function fetchCurrentUser(): Promise<CurrentUserDto | null> {
    const res = await apiFetch(`${API_BASE}/api/me`);
    if (res.status === 401) return null;
    if (res.status === 204) return null;

    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(extractErrorMessage(data, res.status));

    return data as CurrentUserDto;
}

export async function logout(): Promise<void> {
    clearAuthToken();
}

/* =========================
   POIs
========================= */

export type PoiDto = {
    id: number;
    districtId: number | null;
    ownerId: string | null;
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

export type PoiUpdatePayload = {
    name?: string | null;
    namePt?: string | null;
    description?: string | null;
    image?: string | null;
    images?: string[] | null;
    category?: string | null;
    lat?: number | null;
    lon?: number | null;
};

export async function fetchPois(): Promise<PoiDto[]> {
    return jsonFetch<PoiDto[]>(`${API_BASE}/api/pois`);
}

export async function fetchPoiById(id: number): Promise<PoiDto> {
    return jsonFetch<PoiDto>(`${API_BASE}/api/pois/${id}`);
}

export async function updatePoi(id: number, body: PoiUpdatePayload): Promise<PoiDto> {
    return jsonFetch<PoiDto>(`${API_BASE}/api/pois/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function deletePoiById(poiId: number): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/pois/${poiId}`, { method: "DELETE" });
}

/* =========================
   POIs LITE (BBOX)
========================= */

export type PoiLiteDto = {
    id: number;
    districtId: number | null; // futuro
    ownerId: string | null;
    name: string;
    namePt: string | null;
    category: string | null;
    lat: number;
    lon: number;
};

export type PoiLiteResponseDto = {
    pois: PoiLiteDto[];
    countsByCategory: Record<string, number>;
};

export async function fetchPoisLiteBbox(
    bbox: string,
    opts?: { category?: string | null; limit?: number; signal?: AbortSignal }
): Promise<PoiLiteResponseDto> {
    const qs = new URLSearchParams();
    qs.set("bbox", bbox);
    qs.set("limit", String(opts?.limit ?? 2000));
    if (opts?.category) qs.set("category", opts.category);

    return jsonFetch<PoiLiteResponseDto>(`${API_BASE}/api/pois/lite?${qs.toString()}`, {
        signal: opts?.signal,
    });
}

/* =========================
   My POIs
========================= */

export type MyPoiDto = { id: number; name: string; image: string | null };

export async function fetchMyPois(): Promise<MyPoiDto[]> {
    const list = await jsonFetch<PoiDto[]>(`${API_BASE}/api/pois/mine`);
    return (list ?? []).map((p) => ({ id: p.id, name: p.name, image: p.image ?? null }));
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

export async function fetchDistricts(): Promise<DistrictDto[]> {
    return jsonFetch<DistrictDto[]>(`${API_BASE}/api/districts`);
}

export async function fetchDistrictById(id: number): Promise<DistrictDto> {
    return jsonFetch<DistrictDto>(`${API_BASE}/api/districts/${id}`);
}

export async function updateDistrict(id: number, body: DistrictUpdatePayload): Promise<DistrictDto> {
    return jsonFetch<DistrictDto>(`${API_BASE}/api/districts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

/* =========================
   Favorites
========================= */

export type FavoriteDto = { poiId: number; name: string; image: string | null; createdAt: string };

export async function fetchFavorites(): Promise<FavoriteDto[]> {
    return jsonFetch<FavoriteDto[]>(`${API_BASE}/api/favorites`);
}

export async function fetchFavoriteStatus(poiId: number): Promise<{ favorited: boolean } | null> {
    const res = await apiFetch(`${API_BASE}/api/favorites/${poiId}`);

    if (res.status === 401) return null;
    if (res.status === 204) return { favorited: true };
    if (res.status === 404) return { favorited: false };

    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(extractErrorMessage(data, res.status));

    if (data && typeof data.favorite === "boolean") return { favorited: data.favorite };
    if (data && typeof data.favorited === "boolean") return { favorited: data.favorited };
    return { favorited: false };
}

export async function addFavorite(
    poiId: number,
    payload?: { name?: string | null; image?: string | null }
): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/favorites/${poiId}`, {
        method: "POST",
        headers: payload ? { "Content-Type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
    });
}

export async function removeFavorite(poiId: number): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/favorites/${poiId}`, { method: "DELETE" });
}

/* =========================
   Comments
========================= */

export type PoiCommentDto = {
    id: number;
    poiId: number;
    authorName: string;
    body: string;
    createdAt: string;
    updatedAt?: string | null;
    canDelete: boolean;
};

export async function fetchPoiComments(poiId: number): Promise<PoiCommentDto[]> {
    return jsonFetch<PoiCommentDto[]>(`${API_BASE}/api/pois/${poiId}/comments`);
}

export async function addPoiComment(poiId: number, body: string): Promise<PoiCommentDto> {
    return jsonFetch<PoiCommentDto>(`${API_BASE}/api/pois/${poiId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
    });
}

export async function deletePoiComment(commentId: number): Promise<void> {
    await jsonFetch<void>(`${API_BASE}/api/comments/${commentId}`, { method: "DELETE" });
}

/* =========================
   Geocoding
========================= */

export type GeocodeRequestDto = {
    street: string;
    houseNumber?: string;
    postalCode?: string;
    city: string;
    district?: string;
    country?: string;
};

export type GeocodeResponseDto = {
    lat: number;
    lon: number;
    displayName: string;
    provider: string;
    confidence: number;
};

export async function geocodeAddress(req: GeocodeRequestDto): Promise<GeocodeResponseDto> {
    return jsonFetch<GeocodeResponseDto>(`${API_BASE}/api/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
    });
}

/* =========================
   Business POIs (Create)
========================= */

export type CreatePoiPayload = {
    name: string;
    description?: string | null;
    category: string;
    districtId: number;
    municipality: string;
    lat: number;
    lon: number;
    image?: string | null;
    images?: string[] | null;
};

export async function createPoi(body: CreatePoiPayload): Promise<{ id: number }> {
    return jsonFetch<{ id: number }>(`${API_BASE}/api/pois`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: body.name,
            description: body.description ?? null,
            category: body.category,
            districtId: body.districtId,
            municipality: body.municipality,
            lat: body.lat,
            lon: body.lon,
            image: body.image ?? null,
            images: body.images ?? [],
        }),
    });
}

/* =========================
   Search
========================= */

export type SearchItem =
    | { kind: "district"; id: number; name: string }
    | { kind: "poi"; id: number; name: string; districtId?: number | null };

export async function fetchSearch(q: string, limit = 10, signal?: AbortSignal): Promise<SearchItem[]> {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("limit", String(limit));

    return jsonFetch<SearchItem[]>(`${API_BASE}/api/search?${qs.toString()}`, { signal });
}