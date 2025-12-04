// src/lib/poiDb.ts
const DB_NAME = "dot-pt-poi";
const DB_VERSION = 1;
const STORE_NAME = "poiCategories";

type AnyGeo = any;

function openDb(): Promise<IDBDatabase> {
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

export async function getPoiCategoryFromDb(
    catKey: string
): Promise<AnyGeo | null> {
    try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(catKey);

            req.onsuccess = () => {
                const val = req.result;
                resolve(val?.data ?? null);
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function savePoiCategoryToDb(
    catKey: string,
    data: AnyGeo
): Promise<void> {
    try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put({ key: catKey, data });

            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // se falhar, simplesmente não cacheia
    }
}