// src/lib/overpass.ts
import osmtogeojson from "osmtogeojson";

export const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
] as const;

type AnyGeo = any;

type CacheEntry = {
    key: string;          // hash da query
    savedAt: number;      // epoch ms
    data: AnyGeo;         // GeoJSON
};

const CACHE_KEY_PREFIX = "ovps-cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias

function hashQuery(q: string) {
    // simples hash para chavear a cache
    let h = 0;
    for (let i = 0; i < q.length; i++) {
        h = (h * 31 + q.charCodeAt(i)) | 0;
    }
    return String(h);
}

function loadCache(q: string, ttlMs = DEFAULT_TTL_MS): AnyGeo | null {
    try {
        const key = CACHE_KEY_PREFIX + hashQuery(q);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CacheEntry;
        if (Date.now() - parsed.savedAt > ttlMs) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function saveCache(q: string, data: AnyGeo) {
    try {
        const key = CACHE_KEY_PREFIX + hashQuery(q);
        const entry: CacheEntry = { key, savedAt: Date.now(), data };
        localStorage.setItem(key, JSON.stringify(entry));
    } catch {
        // ignore
    }
}

async function fetchOverpassOnce(endpoint: string, query: string, signal?: AbortSignal) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
        signal,
    });
    // 429/504/502 tratados acima por backoff, mas se houver Retry-After respeitamos
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const err: any = new Error(`Overpass ${res.status}: ${txt.slice(0, 200)}`);
        (err.status = res.status), (err.retryAfter = res.headers.get("Retry-After"));
        throw err;
    }
    const json = await res.json();
    return osmtogeojson(json);
}

/**
 * Faz POST ao Overpass com:
 *  - mirrors de fallback
 *  - exponential backoff
 *  - cache localStorage com TTL
 */
export async function overpassQueryToGeoJSON(
    query: string,
    maxRetriesPerEndpoint = 2,
    signal?: AbortSignal,
    ttlMs = DEFAULT_TTL_MS
): Promise<AnyGeo> {
    // 0) cache
    const cached = loadCache(query, ttlMs);
    if (cached) return cached;

    // 1) tenta por endpoints em ordem; por endpoint, tenta com backoff
    for (const ep of OVERPASS_ENDPOINTS) {
        let attempt = 0;
        while (attempt <= maxRetriesPerEndpoint) {
            try {
                const data = await fetchOverpassOnce(ep, query, signal);
                saveCache(query, data);
                return data;
            } catch (e: any) {
                // se abortaram, propaga
                if (e?.name === "AbortError") throw e;

                // 429/5xx → backoff
                const status = e?.status ?? 0;
                const retryAfterHeader = e?.retryAfter ? parseInt(e.retryAfter, 10) : NaN;
                const baseDelay =
                    !Number.isNaN(retryAfterHeader) && retryAfterHeader > 0
                        ? retryAfterHeader * 1000
                        : 500 * Math.pow(2, attempt); // 500ms, 1s, 2s, ...

                // se demasiado client error (ex: 400), salta para próximo endpoint
                if (status && status < 500 && status !== 429) break;

                await new Promise((r) => setTimeout(r, baseDelay));
                attempt++;
            }
        }
        // tenta próximo endpoint
    }
    throw new Error("Overpass: todos os endpoints falharam.");
}

/** Query cultural minimalista: só nodes + tags necessárias (mais rápido) */
export function buildCulturalPointsQuery(poly: string) {
    // apenas nodes (mais leve); sem areas/ways; com tags necessárias
    return `
[out:json][timeout:25];
(
  node[tourism~"^(museum|artwork|viewpoint|attraction)$"](${poly});
  node[historic~"^(castle|monument|memorial|ruins|church)$"](${poly});
);
out center tags;
`;
}