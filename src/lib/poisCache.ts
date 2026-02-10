// src/lib/poisCache.ts
import { openDB, type DBSchema } from "idb";
import type { PoiDto } from "@/lib/api";
import type { PoiInfo } from "@/lib/poiInfo";

const DB_NAME = "ptdot-cache";
const DB_VERSION = 2;

const STORE = "kv";
const KEY_POIS_LITE = "pois_lite_v1";
const KEY_META = "pois_meta_v1";

// prefix para entradas individuais
const KEY_POI_INFO_PREFIX = "poi_info_v1:";

// TTLs (ajusta à vontade)
const POIS_LITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const POI_INFO_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

export type PoisLiteDto = Pick<
    PoiDto,
    | "id"
    | "districtId"
    | "ownerId"
    | "name"
    | "namePt"
    | "category"
    | "subcategory"
    | "lat"
    | "lon"
    | "image"
    | "source"
>;

type PoisMeta = {
    updatedAt: number; // Date.now()
    count: number;
};

type PoiInfoCacheEntry = {
    updatedAt: number;
    poiId: number;
    value: PoiInfo;
};

interface PtdotDB extends DBSchema {
    kv: {
        key: string;
        value: any;
    };
}

function toLite(p: PoiDto): PoisLiteDto {
    return {
        id: p.id,
        districtId: p.districtId ?? null,
        ownerId: p.ownerId ?? null,
        name: p.name,
        namePt: p.namePt ?? null,
        category: p.category ?? null,
        subcategory: p.subcategory ?? null,
        lat: p.lat,
        lon: p.lon,
        image: p.image ?? null,
        source: p.source ?? null,
    };
}

async function db() {
    return openDB<PtdotDB>(DB_NAME, DB_VERSION, {
        upgrade(database, oldVersion) {
            if (!database.objectStoreNames.contains(STORE)) {
                database.createObjectStore(STORE);
            }
            // store é key-value, não precisa de migração por agora
        },
    });
}

/* =========================
   POIs lite (lista)
========================= */

export async function loadPoisLiteFromCache(): Promise<PoisLiteDto[] | null> {
    try {
        const d = await db();
        const meta = (await d.get(STORE, KEY_META)) as PoisMeta | undefined;
        if (!meta?.updatedAt || Date.now() - meta.updatedAt > POIS_LITE_TTL_MS) return null;

        const cached = await d.get(STORE, KEY_POIS_LITE);
        return Array.isArray(cached) ? (cached as PoisLiteDto[]) : null;
    } catch {
        return null;
    }
}

export async function loadPoisMeta(): Promise<PoisMeta | null> {
    try {
        const d = await db();
        const meta = await d.get(STORE, KEY_META);
        return meta && typeof meta === "object" ? (meta as PoisMeta) : null;
    } catch {
        return null;
    }
}

export async function savePoisLiteToCache(pois: PoiDto[]): Promise<void> {
    try {
        const lite = (pois ?? []).map(toLite);
        const meta: PoisMeta = { updatedAt: Date.now(), count: lite.length };

        const d = await db();
        const tx = d.transaction(STORE, "readwrite");
        await tx.store.put(lite, KEY_POIS_LITE);
        await tx.store.put(meta, KEY_META);
        await tx.done;
    } catch {
        // best-effort
    }
}

export async function clearPoisCache(): Promise<void> {
    try {
        const d = await db();
        const tx = d.transaction(STORE, "readwrite");
        await tx.store.delete(KEY_POIS_LITE);
        await tx.store.delete(KEY_META);
        await tx.done;
    } catch {
        /* noop */
    }
}

/* =========================
   POI info (detalhe por POI)
========================= */

function poiInfoKey(poiId: number) {
    return `${KEY_POI_INFO_PREFIX}${poiId}`;
}

export async function loadPoiInfoFromCache(poiId: number): Promise<PoiInfo | null> {
    try {
        const d = await db();
        const entry = (await d.get(STORE, poiInfoKey(poiId))) as PoiInfoCacheEntry | undefined;
        if (!entry?.updatedAt || !entry?.value) return null;

        if (Date.now() - entry.updatedAt > POI_INFO_TTL_MS) return null;

        return entry.value as PoiInfo;
    } catch {
        return null;
    }
}

export async function savePoiInfoToCache(poiId: number, info: PoiInfo): Promise<void> {
    try {
        if (!poiId || !info) return;

        const entry: PoiInfoCacheEntry = {
            poiId,
            updatedAt: Date.now(),
            value: info,
        };

        const d = await db();
        await d.put(STORE, entry, poiInfoKey(poiId));
    } catch {
        // best-effort
    }
}

export async function clearPoiInfoCache(poiId: number): Promise<void> {
    try {
        const d = await db();
        await d.delete(STORE, poiInfoKey(poiId));
    } catch {
        /* noop */
    }
}