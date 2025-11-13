// src/lib/overpass.ts
import osmtogeojson from "osmtogeojson";
import { OVERPASS_ENDPOINTS } from "@/utils/constants";

type AnyGeo = any;

const DEBUG_POI = (() => {
    try {
        if (import.meta.env?.VITE_DEBUG_POI === "true") return true;
        return new URLSearchParams(window.location.search).get("debug") === "poi";
    } catch {
        return false;
    }
})();
const dlog = (...args: any[]) => { if (DEBUG_POI) console.log("[OVP]", ...args); };
const dgrp = (t: string) => { if (DEBUG_POI) console.groupCollapsed(t); };
const dgrpEnd = () => { if (DEBUG_POI) console.groupEnd(); };

type CacheEntry = { key: string; savedAt: number; data: AnyGeo };

const CACHE_KEY_PREFIX = "ovps-cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias
const LAST_CLEANUP_KEY = "ovps-cache:lastCleanup";
const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24 * 3;

function runCacheCleanup(ttlMs = DEFAULT_TTL_MS) {
    try {
        const lastStr = localStorage.getItem(LAST_CLEANUP_KEY);
        const last = lastStr ? Number(lastStr) : 0;
        const now = Date.now();
        if (now - last < CLEANUP_INTERVAL_MS) return;

        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(CACHE_KEY_PREFIX)) continue;
            const raw = localStorage.getItem(k);
            if (!raw) { toDelete.push(k); continue; }
            try {
                const entry = JSON.parse(raw) as { savedAt?: number };
                if (!entry?.savedAt || now - entry.savedAt > ttlMs) toDelete.push(k);
            } catch {
                toDelete.push(k);
            }
        }
        toDelete.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(LAST_CLEANUP_KEY, String(now));
    } catch {
        dlog("Erro a limpar cache local");
    }
}

function hashQuery(q: string) {
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
        dlog("cache HIT", key);
        return parsed.data;
    } catch {
        return null;
    }
}

function saveCache(q: string, data: AnyGeo) {
    try {
        const key = CACHE_KEY_PREFIX + hashQuery(q);
        localStorage.setItem(
            key,
            JSON.stringify({ key, savedAt: Date.now(), data } as CacheEntry)
        );
        dlog("cache SAVE", key);
    } catch {
        /* ignore */
    }
}

/* ---------------------------- fetch de 1 mirror --------------------------- */
async function fetchOverpassOnce(endpoint: string, query: string, signal?: AbortSignal) {
    dlog("fetch mirror:", endpoint);
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

    if (DEBUG_POI) {
        dgrp("[Overpass] raw json");
        console.log(json);
        dgrpEnd();
    }

    const gj = osmtogeojson(json);
    if (DEBUG_POI) {
        dgrp("[Overpass] osmtogeojson");
        console.log(gj);
        dgrpEnd();
    }

    const deduped = dedupeByOsmId(gj);
    const normalized = normalizeToPoints(deduped);
    dlog("features:", normalized?.features?.length ?? 0);
    return normalized;
}

/* --------------------- chamada Overpass com retries/backoff --------------- */
export async function overpassQueryToGeoJSON(
    query: string,
    maxRetriesPerEndpoint = 2,
    signal?: AbortSignal,
    ttlMs = DEFAULT_TTL_MS
): Promise<AnyGeo> {
    const cached = loadCache(query, ttlMs);
    if (cached) return cached;

    for (const ep of OVERPASS_ENDPOINTS) {
        let attempt = 0;
        while (attempt <= maxRetriesPerEndpoint) {
            try {
                dlog("query hash:", hashQuery(query), "attempt:", attempt, "ep:", ep);
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
                        : 500 * Math.pow(2, attempt);

                dlog("mirror fail", { ep, status, attempt, baseDelay });

                if (status && status < 500 && status !== 429) break; // não insistir
                await new Promise(r => setTimeout(r, baseDelay));
                attempt++;
            }
        }
    }
    throw new Error("Overpass: todos os endpoints falharam.");
}

/* --------------------- dedupe/normalize helpers --------------------------- */
function dedupeByOsmId(fc: any) {
    if (!fc || fc.type !== "FeatureCollection") return fc;
    const seen = new Set<string>();
    const out = { type: "FeatureCollection", features: [] as any[] };

    for (const f of fc.features || []) {
        const pid = f?.properties?.["@id"] ?? (f?.id ? String(f.id) : null);
        const key =
            pid ??
            JSON.stringify([
                f?.geometry?.type,
                f?.geometry?.coordinates,
                f?.properties?.name,
            ]);
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        out.features.push(f);
    }
    return out;
}

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
        }
    }

    return out;
}

/* =========================
   QUERIES: 3 grupos de POI
   ========================= */

/** Palácios, castelos, ruínas, monumentos (sem igrejas / natureza) */
export function buildCulturalPointsQuery(poly: string) {
    return `
[out:json][timeout:40];
(
  /* Palácios */
  nwr[historic=palace](${poly});
  nwr[building=palace](${poly});
  nwr[castle_type=palace](${poly});

  /* Castelos e subtipos */
  nwr[historic=castle](${poly});
  nwr[building=castle](${poly});
  nwr[castle_type~"^(castle|fortress)$"](${poly});

  /* Ruínas (genéricas) + de castelo */
  nwr[historic=ruins](${poly});
  nwr[ruins=castle](${poly});

  /* Monumentos */
  nwr[historic=monument](${poly});
);
out center;
`;
}

/** Igrejas / catedrais / capelas / place_of_worship */
export function buildChurchPointsQuery(poly: string) {
    return `
[out:json][timeout:40];
(
  /* Church buildings */
  nwr[building=church](${poly});
  nwr[building=cathedral](${poly});
  nwr[building=chapel](${poly});

  /* Historic religious structures */
  nwr[historic=church](${poly});
  nwr[historic=chapel](${poly});

  /* Generic place of worship */
  nwr[amenity=place_of_worship](${poly});
);
out center;
`;
}

/** Natureza: miradouros + parques/jardins */
export function buildNaturePointsQuery(poly: string) {
    return `
[out:json][timeout:40];
(
  /* Miradouros */
  nwr[tourism=viewpoint](${poly});

  /* Parques e jardins */
  nwr[leisure=park](${poly});
  nwr[leisure=garden](${poly});
  nwr[leisure=recreation_ground](${poly});
);
out center;
`;
}

/** Junta vários FeatureCollection num só + dedupe */
export function mergeFeatureCollections(...collections: AnyGeo[]): AnyGeo {
    const out = { type: "FeatureCollection", features: [] as any[] };

    for (const fc of collections) {
        if (!fc || fc.type !== "FeatureCollection") continue;
        for (const f of fc.features || []) {
            out.features.push(f);
        }
    }

    return dedupeByOsmId(out);
}

runCacheCleanup();