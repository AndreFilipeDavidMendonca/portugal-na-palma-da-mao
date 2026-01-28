import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import { searchWikimediaImagesByName } from "@/lib/wikimedia";
import type { PoiCategory } from "@/utils/constants";
import { mergeMedia, pickPoiId, pickPoiLabel } from "@/utils/poiMedia";
import { isCommercialCategory, normalizeCat } from "@/utils/poiCategory";
import { uniqStrings } from "@/utils/poiGeo";

type PoiCacheEntry = {
    info: PoiInfo;
    media10: string[];
    updatedAt: number;
};

export function usePoiModalController() {
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);

    const reqRef = useRef(0);
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());
    const poiInflightRef = useRef<Map<number, Promise<void>>>(new Map());
    console.log("[usePoiModalController] selectedPoi =", selectedPoi);
    console.log("[usePoiModalController] has properties?", Boolean(selectedPoi?.properties));
    const closePoiModal = useCallback(() => {
        setShowPoiModal(false);
        setSelectedPoi(null);
        setPoiInfo(null);
        setLoadingPoi(false);
    }, []);

    // helper: abre modal de forma determinística
    const openWithInfo = useCallback((info: PoiInfo) => {
        setPoiInfo(info);
        setShowPoiModal(true);
        setLoadingPoi(false);
    }, []);

    useEffect(() => {
        let alive = true;

        (async () => {
            if (!selectedPoi?.properties) return;

            const reqId = ++reqRef.current;

            // reset UI
            setShowPoiModal(false);
            setPoiInfo(null);
            setLoadingPoi(true);

            const poiId = pickPoiId(selectedPoi);
            const label = pickPoiLabel(selectedPoi);

            if (!label) {
                if (alive && reqRef.current === reqId) setLoadingPoi(false);
                return;
            }

            // ✅ cache hit: abre logo
            if (poiId != null) {
                const cached = poiCacheRef.current.get(poiId);
                if (cached) {
                    if (!alive || reqRef.current !== reqId) return;
                    openWithInfo(cached.info);
                    return;
                }

                // ✅ inflight dedupe: quando terminar, abre logo
                const inflight = poiInflightRef.current.get(poiId);
                if (inflight) {
                    await inflight;
                    if (!alive || reqRef.current !== reqId) return;

                    const after = poiCacheRef.current.get(poiId);
                    if (after) {
                        openWithInfo(after.info);
                        return;
                    }

                    if (alive && reqRef.current === reqId) setLoadingPoi(false);
                    return;
                }
            }

            const task = (async () => {
                const approxLat = selectedPoi.geometry?.coordinates?.[1];
                const approxLon = selectedPoi.geometry?.coordinates?.[0];

                const base = await fetchPoiInfo({
                    approx: {
                        name: label,
                        lat: typeof approxLat === "number" ? approxLat : null,
                        lon: typeof approxLon === "number" ? approxLon : null,
                    },
                    sourceFeature: selectedPoi,
                });

                if (!alive || reqRef.current !== reqId) return;
                if (!base) {
                    setLoadingPoi(false);
                    return;
                }

                const featureCat: PoiCategory | null = normalizeCat(selectedPoi?.properties?.category);
                const allowWiki = !isCommercialCategory(featureCat);

                let merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

                if (allowWiki && merged.length < 10) {
                    try {
                        const wiki = await searchWikimediaImagesByName(label, 10);
                        if (!alive || reqRef.current !== reqId) return;
                        merged = mergeMedia(merged, wiki ?? [], 10);
                    } catch {
                        // ignore
                    }
                }

                const infoNow: PoiInfo = {
                    ...base,
                    image: merged[0] ?? base.image ?? null,
                    images: merged,
                };

                // ✅ abre logo com base (sem depender de timeout)
                openWithInfo(infoNow);

                if (poiId != null) {
                    poiCacheRef.current.set(poiId, { info: infoNow, media10: merged, updatedAt: Date.now() });
                }

                // background: tentar completar para 10 e atualizar modal se ainda for o mesmo req
                if (allowWiki) {
                    (async () => {
                        try {
                            const wiki10 = await searchWikimediaImagesByName(label, 10);
                            if (!wiki10) return;

                            const full10 = mergeMedia(merged, wiki10, 10);
                            const info10: PoiInfo = {
                                ...base,
                                image: full10[0] ?? base.image ?? null,
                                images: full10,
                            };

                            if (poiId != null) {
                                poiCacheRef.current.set(poiId, { info: info10, media10: full10, updatedAt: Date.now() });
                            }

                            if (!alive || reqRef.current !== reqId) return;

                            // ✅ só atualiza a info, não mexe no show/open
                            setPoiInfo(info10);
                        } catch (e) {
                            console.warn("[POI] background wiki10 failed", e);
                        }
                    })();
                }
            })();

            if (poiId != null) poiInflightRef.current.set(poiId, task);
            await task;
            if (poiId != null) poiInflightRef.current.delete(poiId);
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi, openWithInfo]);

    return {
        selectedPoi,
        setSelectedPoi,
        poiInfo,
        showPoiModal,
        loadingPoi,
        closePoiModal,
    };
}