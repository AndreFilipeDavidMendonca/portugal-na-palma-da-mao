// src/lib/overpass.ts
import osmtogeojson from "osmtogeojson";

/** Mirrors do Overpass (ordem de tentativa) */
export const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
] as const;

type AnyGeo = any;

type CacheEntry = {
    key: string;
    savedAt: number;
    data: AnyGeo;
};

const CACHE_KEY_PREFIX = "ovps-cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias

/* ------------------------- util cache localStorage ------------------------ */
function hashQuery(q: string) {
    let h = 0;
    for (let i = 0; i < q.length; i++) h = (h * 31 + q.charCodeAt(i)) | 0;
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

/* --------------------- helpers: dedupe + normalização --------------------- */
/** Dedupe por @id (formato OSM: node/way/relation) */
function dedupeByOsmId(fc: any) {
    if (!fc || fc.type !== "FeatureCollection") return fc;
    const seen = new Set<string>();
    const out = { type: "FeatureCollection", features: [] as any[] };

    for (const f of fc.features || []) {
        const pid =
            f?.properties?.["@id"] ??
            (f?.id ? String(f.id) : null);
        const key = pid ?? JSON.stringify([f?.geometry?.type, f?.geometry?.coordinates, f?.properties?.name]);
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.features.push(f);
    }
    return out;
}

/**
 * Converte qualquer FeatureCollection do OSM para pontos:
 * - se já for Point, mantém;
 * - se tiver `properties.center {lat,lon}`, usa-o;
 * - senão, usa centro do bbox quando disponível.
 * (corre **após** dedupe)
 */
function normalizeToPoints(fc: any) {
    if (!fc || fc.type !== "FeatureCollection") return fc;

    const out = { type: "FeatureCollection", features: [] as any[] };

    for (const f of fc.features || []) {
        if (f?.geometry?.type === "Point") {
            out.features.push(f);
            continue;
        }

        const c = f?.properties?.center;
        if (c && typeof c.lat === "number" && typeof c.lon === "number") {
            out.features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [c.lon, c.lat] },
                properties: f.properties || {},
            });
            continue;
        }

        const bb = f?.bbox;
        if (Array.isArray(bb) && bb.length === 4) {
            const lon = (bb[0] + bb[2]) / 2;
            const lat = (bb[1] + bb[3]) / 2;
            out.features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [lon, lat] },
                properties: f.properties || {},
            });
            continue;
        }
    }

    return out;
}

/* ---------------------------- fetch de 1 mirror --------------------------- */
async function fetchOverpassOnce(endpoint: string, query: string, signal?: AbortSignal) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
        signal,
    });

    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const err: any = new Error(`Overpass ${res.status}: ${txt.slice(0, 200)}`);
        err.status = res.status;
        err.retryAfter = res.headers.get("Retry-After");
        throw err;
    }

    const json = await res.json();
    // osmtogeojson já calcula bbox e center quando possível
    const gj = osmtogeojson(json);
    const deduped = dedupeByOsmId(gj);
    return normalizeToPoints(deduped);
}

/* --------------------- chamada Overpass com retries/backoff --------------- */
export async function overpassQueryToGeoJSON(
    query: string,
    maxRetriesPerEndpoint = 2,
    signal?: AbortSignal,
    ttlMs = DEFAULT_TTL_MS
): Promise<AnyGeo> {
    // cache
    const cached = loadCache(query, ttlMs);
    if (cached) return cached;

    for (const ep of OVERPASS_ENDPOINTS) {
        let attempt = 0;
        while (attempt <= maxRetriesPerEndpoint) {
            try {
                const data = await fetchOverpassOnce(ep, query, signal);
                saveCache(query, data);
                return data;
            } catch (e: any) {
                if (e?.name === "AbortError") throw e;

                const status = e?.status ?? 0;
                const retryAfterHeader = e?.retryAfter ? parseInt(e.retryAfter, 10) : NaN;
                const baseDelay =
                    !Number.isNaN(retryAfterHeader) && retryAfterHeader > 0
                        ? retryAfterHeader * 1000
                        : 500 * Math.pow(2, attempt); // 500ms → 1s → 2s …

                // 4xx (exceto 429) → não insistir no mesmo mirror
                if (status && status < 500 && status !== 429) break;

                await new Promise((r) => setTimeout(r, baseDelay));
                attempt++;
            }
        }
    }
    throw new Error("Overpass: todos os endpoints falharam.");
}

/* ----------------------------- queries de domínio ------------------------- */
/**
 * Query cultural enxuta:
 * - usa nwr (node/way/relation)
 * - regex para reduzir número de cláusulas
 * - cobre palácios (historic/building/castle_type=palace)
 * - cobre castelos, ruínas de castelo, igrejas e miradouros
 */
export function buildCulturalPointsQuery(poly: string) {
    return `
[out:json][timeout:40];
(
  /* Palácios (prioridade alta no parsing) */
  nwr[historic=palace](${poly});
  nwr[building=palace](${poly});
  nwr[castle_type=palace](${poly});

  /* Castelos e subtipos */
  nwr[historic=castle](${poly});
  nwr[building=castle](${poly});
  nwr[castle_type~"^(castle|fortress)$"](${poly});

  /* Ruínas (genéricas) + ruínas explicitamente de castelo */
  nwr[historic=ruins](${poly});
  nwr[ruins=castle](${poly});

  /* Monumentos */
  nwr[historic=monument](${poly});

  /* Igrejas (vários jeitos de mapeamento) */
  nwr[historic=church](${poly});
  nwr[amenity=place_of_worship](${poly});
  nwr[building=church](${poly});

  /* Miradouros */
  nwr[tourism=viewpoint](${poly});
);
out center tags qt;
`;
}