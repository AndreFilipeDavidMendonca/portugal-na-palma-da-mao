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

/* =========================
   Cache antiga por query (localStorage)
   ========================= */

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
        // ignoramos erros (inclui QuotaExceeded)
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

/* =========================
   Categoria de POI (__cat)
   ========================= */

function classifyPoiCategory(props: any): string | null {
    console.log("classifyPoiCategory props:", props);
    if (!props) return null;

    const tags =
        (props.tags && Object.keys(props.tags).length > 0
            ? props.tags
            : props) ?? {};

    console.log("classifyPoiCategory tags:", tags);

    // Miradouros
    if (tags.tourism === "viewpoint") {
        return "viewpoint";
    }

    // Parques / jardins / recreio / picnic
    if (
        tags.leisure === "park" ||
        tags.leisure === "garden" ||
        tags.leisure === "recreation_ground" ||
        tags.leisure === "picnic_site" ||
        tags.tourism === "picnic_site"
    ) {
        return "park";
    }

    // Palácios
    if (
        tags.historic === "palace" ||
        tags.building === "palace" ||
        tags.castle_type === "palace"
    ) {
        return "palace";
    }

    // Castelos
    if (
        tags.historic === "castle" ||
        tags.building === "castle" ||
        (typeof tags.castle_type === "string" &&
            /^(castle|fortress)$/i.test(tags.castle_type))
    ) {
        return "castle";
    }

    // Igrejas / templos
    if (
        tags.building === "church" ||
        tags.building === "cathedral" ||
        tags.building === "chapel" ||
        tags.historic === "church" ||
        tags.historic === "chapel" ||
        tags.amenity === "place_of_worship"
    ) {
        return "church";
    }

    // Monumentos genéricos
    if (tags.historic === "monument") {
        return "monument";
    }

    return null;
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
        const baseProps = f.properties || {};
        const cat = classifyPoiCategory(baseProps);

        const propsWithCat = {
            ...baseProps,
            __cat: baseProps.__cat ?? cat ?? undefined,
        };

        if (f?.geometry?.type === "Point") {
            out.features.push({
                ...f,
                properties: propsWithCat,
            });
            continue;
        }

        const c = baseProps.center;
        if (c && typeof c.lat === "number" && typeof c.lon === "number") {
            out.features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [c.lon, c.lat] },
                properties: propsWithCat,
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
                properties: propsWithCat,
            });
        }
    }

    return out;
}

/* =========================
   QUERIES: 3 grupos de POI
   ========================= */

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

  /* Parques / áreas de merendas / picnic */
  nwr[leisure=picnic_site](${poly});
  nwr[tourism=picnic_site](${poly});
  nwr[amenity=picnic_site](${poly});
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

/* =========================
   Cache por categoria (IndexedDB)
   ========================= */

export type PoiCategory =
    | "palace"
    | "castle"
    | "ruins"
    | "monument"
    | "church"
    | "viewpoint"
    | "park";

function isFeatureCollection(obj: any): obj is AnyGeo {
    return obj && obj.type === "FeatureCollection" && Array.isArray(obj.features);
}

/* ---- IndexedDB helpers ---- */

const DB_NAME = "dot-pt-poi";
const DB_VERSION = 1;
const STORE_NAME = "poiCategories";

function openPoiDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "key" });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getPoiCategoryFromDb(key: string): Promise<AnyGeo | null> {
    try {
        const db = await openPoiDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);

            req.onsuccess = () => {
                const val = req.result as { key: string; data: AnyGeo } | undefined;
                resolve(val?.data ?? null);
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

async function savePoiCategoryToDb(key: string, data: AnyGeo): Promise<void> {
    if (!isFeatureCollection(data)) return;
    try {
        const db = await openPoiDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key, data });

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // se falhar, ignoramos — fica só em memória
    }
}

/** Faz a query certa + aplica cache por categoria (IndexedDB) */
export async function fetchPoiCategoryGeoJSON(
    cat: PoiCategory,
    poly: string,
    signal?: AbortSignal
): Promise<AnyGeo> {
    const key = `ovps-poi-cat:${cat}`;

    // 1) tentar cache em IndexedDB
    try {
        const cached = await getPoiCategoryFromDb(key);
        if (cached) {
            dlog("[POI] DB cache HIT:", cat);
            return cached;
        }
    } catch {
        // se der erro, seguimos para Overpass
    }

    // 2) escolher query conforme a categoria
    let query: string;
    switch (cat) {
        case "palace":
        case "castle":
        case "ruins":
        case "monument":
            query = buildCulturalPointsQuery(poly);
            break;
        case "church":
            query = buildChurchPointsQuery(poly);
            break;
        case "viewpoint":
        case "park":
            query = buildNaturePointsQuery(poly);
            break;
        default:
            query = buildNaturePointsQuery(poly);
    }

    dlog("[POI] DB cache MISS, a chamar Overpass:", cat);
    const fc = await overpassQueryToGeoJSON(query, 2, signal);

    // 3) best-effort save em IndexedDB
    savePoiCategoryToDb(key, fc).catch(() => {});

    return fc;
}

runCacheCleanup();