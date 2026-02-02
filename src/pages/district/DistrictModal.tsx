// src/pages/district/DistrictModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { loadGeo } from "@/lib/geo";
import { POI_LABELS, type PoiCategory } from "@/utils/constants";

import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";

import { type DistrictUpdatePayload, fetchDistrictById, updateDistrict } from "@/lib/api";
import { type DistrictInfo, fetchDistrictInfo } from "@/lib/districtInfo";

import { getDistrictCommonsGallery } from "@/lib/wikimedia";
import { searchWikimediaIfAllowed } from "@/lib/wikiGate";

import { normalizeCat } from "@/utils/poiCategory";

import "./DistrictModal.scss";
import DistrictAsidePanel from "@/components/DistrictAsidePanel/DistrictAsidePanel";
import DistrictGalleryPane from "@/components/DistrictGalleryPane/DistrictGalleryPane";
import DistrictMapPane from "@/components/DistrictMapPane/DistrictMapPane";
import PoiFiltersMobileDropdown from "@/features/filters/PoiFilter/PoiFiltersMobileDropdown";

type AnyGeo = any;

/* ---------------- Helpers ---------------- */

const uniqStrings = (arr: string[]): string[] => Array.from(new Set((arr ?? []).filter(Boolean)));

const pickPoiLabel = (feature: any): string | null => {
    const p = feature?.properties ?? {};
    const label = p.namePt ?? p["name:pt"] ?? p.name ?? p["name:en"] ?? p.label ?? null;
    return typeof label === "string" && label.trim().length >= 3 ? label.trim() : null;
};

const pickPoiId = (feature: any): number | null => {
    const id = feature?.properties?.id;
    return typeof id === "number" ? id : null;
};

const mergeMedia = (base: string[], extra: string[], limit = 10) =>
    uniqStrings([...base, ...extra]).slice(0, limit);

/* ---------------- Types ---------------- */

type Props = {
    open: boolean;
    onClose: () => void;

    districtFeature: AnyGeo | null;

    selectedTypes: Set<PoiCategory>;
    onToggleType: (k: PoiCategory) => void;
    onClearTypes: () => void;

    poiPoints: AnyGeo | null;
    poiAreas?: AnyGeo | null;

    rivers?: AnyGeo | null;
    lakes?: AnyGeo | null;
    rails?: AnyGeo | null;
    roads?: AnyGeo | null;
    peaks?: AnyGeo | null;
    places?: AnyGeo | null;

    onPoiUpdated?: (patch: {
        id: number;
        name?: string | null;
        namePt?: string | null;
        description?: string | null;
        image?: string | null;
        images?: string[] | null;
    }) => void;

    isAdmin?: boolean;
};

type PoiCacheEntry = {
    info: PoiInfo;
    media10: string[];
    updatedAt: number;
};

export default function DistrictModal(props: Props) {
    const {
        open,
        onClose,
        districtFeature,
        selectedTypes,
        onToggleType,
        onClearTypes,
        poiPoints,
        poiAreas = null,
        rivers: riversProp = null,
        lakes: lakesProp = null,
        rails: railsProp = null,
        roads: roadsProp = null,
        peaks: peaksProp = null,
        places: placesProp = null,
        onPoiUpdated,
        isAdmin = false,
    } = props;

    /* ---------------- POI selection ---------------- */

    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);

    // preload gate invisível
    const [preloadReqId, setPreloadReqId] = useState(0);
    const [preloadInfo, setPreloadInfo] = useState<PoiInfo | null>(null);
    const [preloadItems, setPreloadItems] = useState<string[]>([]);

    const reqRef = useRef(0);

    // cache + inflight
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());
    const poiInflightRef = useRef<Map<number, Promise<void>>>(new Map());

    // progresso do preload (para abrir por timeout com 0/1/2)
    const preloadProgressRef = useRef<{ ready: boolean; loaded: string[]; failed: string[]; total: number } | null>(null);
    const preloadOpenedRef = useRef(false);

    /* ---------------- Layers / filtros ---------------- */

    const [renderNonce, setRenderNonce] = useState(0);

    const [rivers, setRivers] = useState<any>(riversProp);
    const [lakes, setLakes] = useState<any>(lakesProp);
    const [rails, setRails] = useState<any>(railsProp);
    const [roads, setRoads] = useState<any>(roadsProp);
    const [peaks, setPeaks] = useState<any>(peaksProp);
    const [places, setPlaces] = useState<any>(placesProp);

    /* ---------------- District info ---------------- */

    const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
    const [editingDistrict, setEditingDistrict] = useState(false);
    const [savingDistrict, setSavingDistrict] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);

    const [distName, setDistName] = useState<string>("");
    const [distPopulation, setDistPopulation] = useState<string>("");
    const [distMunicipalities, setDistMunicipalities] = useState<string>("");
    const [distParishes, setDistParishes] = useState<string>("");
    const [distInhabitedSince, setDistInhabitedSince] = useState<string>("");
    const [distDescription, setDistDescription] = useState<string>("");
    const [distHistory, setDistHistory] = useState<string>("");
    const [distMedia, setDistMedia] = useState<string[]>([]);

    const [showGallery, setShowGallery] = useState(false);
    const [loadingGallery, setLoadingGallery] = useState(false);

    /* ---------------- Reset ao fechar ---------------- */

    useEffect(() => {
        if (!open) {
            setShowGallery(false);
            setEditingDistrict(false);
            setDistrictError(null);

            setSelectedPoi(null);
            setPoiInfo(null);
            setShowPoiModal(false);
            setLoadingPoi(false);

            setPreloadInfo(null);
            setPreloadItems([]);
            setPreloadReqId(0);

            preloadProgressRef.current = null;
            preloadOpenedRef.current = false;
        }
    }, [open]);

    /* ---------------- Load districtInfo ---------------- */

    useEffect(() => {
        let alive = true;

        (async () => {
            const name = districtFeature?.properties?.name;
            if (!name || typeof name !== "string") {
                if (alive) setDistrictInfo(null);
                return;
            }

            try {
                const info = await fetchDistrictInfo(name);
                if (!alive) return;
                setDistrictInfo(info);
            } catch {
                if (alive) setDistrictInfo(null);
            }
        })();

        return () => {
            alive = false;
        };
    }, [districtFeature]);

    useEffect(() => {
        const baseName =
            (districtFeature?.properties?.name as string | undefined) ||
            districtInfo?.namePt ||
            districtInfo?.name ||
            "Distrito";

        setDistName(baseName);

        if (districtInfo) {
            setDistPopulation(districtInfo.population != null ? String(districtInfo.population) : "");
            setDistMunicipalities(districtInfo.municipalities != null ? String(districtInfo.municipalities) : "");
            setDistParishes(districtInfo.parishes != null ? String(districtInfo.parishes) : "");
            setDistInhabitedSince(districtInfo.inhabited_since ?? "");
            setDistDescription(districtInfo.description ?? "");
            setDistHistory(districtInfo.history ?? "");
            setDistMedia(districtInfo.files ?? []);
        } else {
            setDistPopulation("");
            setDistMunicipalities("");
            setDistParishes("");
            setDistInhabitedSince("");
            setDistDescription("");
            setDistHistory("");
            setDistMedia([]);
        }

        setEditingDistrict(false);
        setDistrictError(null);
    }, [districtInfo, districtFeature]);

    /* ---------------- Lazy load geo layers ---------------- */

    useEffect(() => {
        const safeLoad = async (path: string, set: (v: any) => void, already: any) => {
            if (already) return;
            try {
                const gj = await loadGeo(path);
                if (gj && (gj.type === "FeatureCollection" || gj.type === "Feature")) set(gj);
                else set(null);
            } catch {
                set(null);
            }
        };

        const safeLoadParts = async (
            paths: string[],
            set: (v: any) => void,
            already: any
        ) => {
            if (already) return;
            try {
                const parts = await Promise.all(paths.map((p) => loadGeo(p)));
                const features = parts.flatMap((p: any) => (p?.features ?? []));
                if (features.length > 0) {
                    set({ type: "FeatureCollection", features });
                } else {
                    set(null);
                }
            } catch {
                set(null);
            }
        };

        // rios e lagos também estão em pt1/pt2 no teu repo
        safeLoadParts(["/geo/rios_pt1.geojson", "/geo/rios_pt2.geojson"], setRivers, riversProp);
        safeLoadParts(["/geo/lagos_pt1.geojson", "/geo/lagos_pt2.geojson"], setLakes, lakesProp);

        // ferrovias e estradas estão em pt1/pt2
        safeLoadParts(["/geo/ferrovias_pt1.geojson", "/geo/ferrovias_pt2.geojson"], setRails, railsProp);
        safeLoadParts(["/geo/estradas_pt1.geojson", "/geo/estradas_pt2.geojson"], setRoads, roadsProp);

        // estes só ativa se existirem mesmo no public/geo
        // safeLoad("/geo/picos_pt.geojson", setPeaks, peaksProp);
        // safeLoad("/geo/cidades_pt.geojson", setPlaces, placesProp);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /* ---------------- POIs normalization ---------------- */

    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };

                const name = props["name:pt"] || props.name || props["name:en"] || props.label || null;
                if (!name || typeof name !== "string" || name.trim() === "") return null;

                const nf = { ...f, properties: { ...props } as any };

                const rawCat = props.category as unknown;
                const cat = normalizeCat(rawCat);

                if (cat) {
                    (nf.properties as any).__cat = cat;
                    (nf.properties as any).category = cat;
                }

                return nf;
            })
            .filter(Boolean);

        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    const countsByCat = useMemo<Record<PoiCategory, number>>(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        for (const f of normalizedPoints?.features ?? []) {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalizedPoints]);

    const filteredPoints = useMemo(() => {
        if (!normalizedPoints) return null;
        if (!selectedTypes || selectedTypes.size === 0) return normalizedPoints;

        const feats = normalizedPoints.features.filter((f: any) => {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            return cat ? selectedTypes.has(cat) : false;
        });

        return { ...normalizedPoints, features: feats };
    }, [normalizedPoints, selectedTypes]);

    /* ---------------- POI click ---------------- */

    const onPoiClick = (feature: any) => {
        setSelectedPoi(feature);
    };

    /* ---------------- POI: fetch base + (gate) wiki ---------------- */

    useEffect(() => {
        let alive = true;

        (async () => {
            if (!selectedPoi?.properties) return;

            const reqId = ++reqRef.current;

            // reset UI POI
            setShowPoiModal(false);
            setPoiInfo(null);
            setPreloadInfo(null);
            setPreloadItems([]);
            setPreloadReqId(reqId);

            preloadProgressRef.current = null;
            preloadOpenedRef.current = false;

            setLoadingPoi(true);

            const poiId = pickPoiId(selectedPoi);
            const label = pickPoiLabel(selectedPoi);

            if (!label) {
                if (alive && reqRef.current === reqId) setLoadingPoi(false);
                return;
            }

            // Cache hit
            if (poiId != null) {
                const cached = poiCacheRef.current.get(poiId);
                if (cached) {
                    if (!alive || reqRef.current !== reqId) return;

                    setPoiInfo(cached.info);
                    setPreloadInfo(cached.info);
                    setPreloadItems(cached.media10);
                    setPreloadReqId(reqId);
                    return;
                }

                // inflight dedupe
                const inflight = poiInflightRef.current.get(poiId);
                if (inflight) {
                    await inflight;
                    if (!alive || reqRef.current !== reqId) return;

                    const after = poiCacheRef.current.get(poiId);
                    if (after) {
                        setPoiInfo(after.info);
                        setPreloadInfo(after.info);
                        setPreloadItems(after.media10);
                        setPreloadReqId(reqId);
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

                // ✅ fonte de verdade do gate
                const baseCategory = base.category ?? null;

                let merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

                if (merged.length < 10) {
                    const wiki10 = await searchWikimediaIfAllowed(label, 10, baseCategory);
                    if (!alive || reqRef.current !== reqId) return;
                    merged = mergeMedia(merged, wiki10 ?? [], 10);
                }

                const infoNow: PoiInfo = {
                    ...base,
                    image: merged[0] ?? base.image ?? null,
                    images: merged,
                };

                setPoiInfo(infoNow);
                setPreloadInfo(infoNow);
                setPreloadItems(merged);
                setPreloadReqId(reqId);

                if (poiId != null) {
                    poiCacheRef.current.set(poiId, { info: infoNow, media10: merged, updatedAt: Date.now() });
                }

                // background: tentar completar (gate aplicado)
                (async () => {
                    try {
                        const wiki10 = await searchWikimediaIfAllowed(label, 10, baseCategory);
                        if (!wiki10 || wiki10.length === 0) return;

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

                        setPoiInfo(info10);
                        setPreloadItems(full10);
                    } catch (e) {
                        console.warn("[POI] background wiki10 failed", e);
                    }
                })();
            })();

            if (poiId != null) poiInflightRef.current.set(poiId, task);
            await task;
            if (poiId != null) poiInflightRef.current.delete(poiId);
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi]);

    /* ---------------- Fallback: abre modal após timeout ---------------- */

    useEffect(() => {
        if (!loadingPoi) return;
        if (!preloadInfo) return;

        const reqId = preloadReqId;
        const TIMEOUT_MS = 900;

        const t = window.setTimeout(() => {
            if (reqId !== reqRef.current) return;
            if (preloadOpenedRef.current) return;
            if (showPoiModal) return;

            const progress = preloadProgressRef.current;
            const loaded = uniqStrings(progress?.loaded ?? []).slice(0, 10);

            const rest = preloadItems.filter((u) => !loaded.includes(u));
            const finalMedia = [...loaded, ...rest].slice(0, 10);

            const base = poiInfo ?? preloadInfo;

            const readyInfo: PoiInfo = {
                ...base,
                image: finalMedia[0] ?? base.image ?? null,
                images: finalMedia,
            };

            setPoiInfo(readyInfo);
            setShowPoiModal(true);

            setLoadingPoi(false);
            setPreloadInfo(null);
            setPreloadItems([]);
            preloadOpenedRef.current = true;
        }, TIMEOUT_MS);

        return () => window.clearTimeout(t);
    }, [loadingPoi, preloadInfo, preloadItems, preloadReqId, poiInfo, showPoiModal]);

    /* ---------------- District save / cancel ---------------- */

    const handleDistrictSave = async () => {
        if (!isAdmin) return;
        if (!districtInfo?.id) {
            setDistrictError("ID do distrito em falta.");
            return;
        }

        setSavingDistrict(true);
        setDistrictError(null);

        try {
            const payload: DistrictUpdatePayload = {
                name: distName || districtInfo.name,
                namePt: distName || districtInfo.namePt || districtInfo.name,
                description: distDescription || null,
                history: distHistory || null,
                inhabitedSince: distInhabitedSince || null,
                population: distPopulation ? Number(distPopulation.replace(/\D/g, "")) : null,
                municipalitiesCount: distMunicipalities ? Number(distMunicipalities) : null,
                parishesCount: distParishes ? Number(distParishes) : null,
                files: distMedia.length > 0 ? distMedia : [],
            };

            const updated = await updateDistrict(districtInfo.id, payload);

            setDistrictInfo({
                ...districtInfo,
                population: updated.population,
                municipalities: updated.municipalitiesCount,
                parishes: updated.parishesCount,
                inhabited_since: updated.inhabitedSince,
                description: updated.description,
                history: updated.history,
                files: updated.files ?? [],
            });

            setEditingDistrict(false);
            setShowGallery(false);
        } catch (e: any) {
            setDistrictError(e?.message || "Falha ao guardar alterações do distrito.");
        } finally {
            setSavingDistrict(false);
        }
    };

    const handleCancelEdit = () => {
        if (!isAdmin) {
            setEditingDistrict(false);
            setDistrictError(null);
            return;
        }

        if (districtInfo) {
            setDistPopulation(districtInfo.population != null ? String(districtInfo.population) : "");
            setDistMunicipalities(districtInfo.municipalities != null ? String(districtInfo.municipalities) : "");
            setDistParishes(districtInfo.parishes != null ? String(districtInfo.parishes) : "");
            setDistInhabitedSince(districtInfo.inhabited_since ?? "");
            setDistDescription(districtInfo.description ?? "");
            setDistHistory(districtInfo.history ?? "");
            setDistMedia(districtInfo.files ?? []);
        }

        setEditingDistrict(false);
        setDistrictError(null);
        setShowGallery(false);
    };

    /* ---------------- District gallery ---------------- */

    const districtNameFallback = (districtFeature?.properties?.name as string | undefined) || "Distrito";

    const mediaUrls = useMemo(() => {
        const uniq: string[] = [];
        for (const u of distMedia ?? []) {
            if (!u) continue;
            if (!uniq.includes(u)) uniq.push(u);
        }

        const isVideoUrlLocal = (url: string) => {
            const namePart = url.split("#name=")[1] ?? url;
            return /\.(mp4|webm|ogg|mov|m4v)$/i.test(namePart);
        };

        const videos = uniq.filter(isVideoUrlLocal);
        const images = uniq.filter((u) => !isVideoUrlLocal(u));
        return [...videos, ...images].slice(0, 10);
    }, [distMedia]);

    const rootClass = "district-modal theme-dark" + (showGallery ? " district-modal--gallery-open" : "");

    const toggleGallery = () => {
        if (showGallery) {
            setShowGallery(false);
            setEditingDistrict(false);
            setDistrictError(null);
            setLoadingGallery(false);
            return;
        }

        setLoadingGallery(true);

        (async () => {
            try {
                let dbFiles: string[] = [];

                if (districtInfo?.id) {
                    const dto = await fetchDistrictById(districtInfo.id);
                    dbFiles = dto.files ?? [];

                    setDistrictInfo((prev) =>
                        prev
                            ? {
                                ...prev,
                                population: dto.population ?? prev.population,
                                municipalities: dto.municipalitiesCount ?? prev.municipalities,
                                parishes: dto.parishesCount ?? prev.parishes,
                                inhabited_since: dto.inhabitedSince ?? prev.inhabited_since,
                                description: dto.description ?? prev.description,
                                history: dto.history ?? prev.history,
                                files: dbFiles,
                            }
                            : prev
                    );
                }

                const nameForSearch = distName || districtInfo?.namePt || districtInfo?.name || districtNameFallback;

                const firstCommons = await getDistrictCommonsGallery(nameForSearch, 3);
                let merged = uniqStrings([...dbFiles, ...firstCommons]).slice(0, 10);

                setDistMedia(merged);
                setShowGallery(true);
                setLoadingGallery(false);

                if (merged.length < 10) {
                    try {
                        const fullCommons = await getDistrictCommonsGallery(nameForSearch, 10);
                        const mergedFull = uniqStrings([...dbFiles, ...fullCommons]).slice(0, 10);

                        if (mergedFull.length > merged.length) {
                            merged = mergedFull;
                            setDistMedia(mergedFull);

                            if (districtInfo?.id) {
                                try {
                                    const updated = await updateDistrict(districtInfo.id, { files: mergedFull });
                                    setDistrictInfo((prev) => (prev ? { ...prev, files: updated.files ?? mergedFull } : prev));
                                } catch (e) {
                                    console.warn("[DistrictModal] Falha ao atualizar ficheiros do distrito (batch completo)", e);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("[DistrictModal] Falha batch completo da galeria", e);
                    }
                } else if (districtInfo?.id) {
                    try {
                        const updated = await updateDistrict(districtInfo.id, { files: merged });
                        setDistrictInfo((prev) => (prev ? { ...prev, files: updated.files ?? merged } : prev));
                    } catch (e) {
                        console.warn("[DistrictModal] Falha ao atualizar ficheiros do distrito (batch inicial)", e);
                    }
                }
            } catch (e) {
                console.warn("[DistrictModal] Falha a preparar galeria", e);
                setDistMedia([]);
                setShowGallery(true);
                setLoadingGallery(false);
            }
        })();
    };

    /* ---------------- Render ---------------- */

    if (!open) return null;

    return (
        <div className={rootClass}>
            <div className="poi-top">
                <PoiFiltersMobileDropdown
                    selected={selectedTypes}
                    onToggle={onToggleType}
                    onClear={() => {
                        onClearTypes();
                        setRenderNonce((n) => n + 1);
                    }}
                    countsByCat={countsByCat}
                />

                {/* ✅ Desktop: barra normal */}
                <PoiFilter
                    variant="top"
                    selected={selectedTypes}
                    onToggle={onToggleType}
                    onClear={() => {
                        onClearTypes();
                        setRenderNonce((n) => n + 1);
                    }}
                    countsByCat={countsByCat}
                    showClose
                    onClose={onClose}
                />
            </div>
            <div className="modal-content">
                <div className="left-pane">
                    {!showGallery ? (
                        <DistrictMapPane
                            districtFeature={districtFeature}
                            rivers={rivers}
                            lakes={lakes}
                            rails={rails}
                            roads={roads}
                            peaks={peaks}
                            places={places}
                            poiAreas={poiAreas}
                            filteredPoints={filteredPoints}
                            selectedTypes={selectedTypes}
                            renderNonce={renderNonce}
                            onPoiClick={onPoiClick}
                        />
                    ) : (
                        <DistrictGalleryPane
                            title={distName || districtNameFallback}
                            mediaUrls={mediaUrls}
                            editing={editingDistrict}
                            isAdmin={isAdmin}
                            districtId={districtInfo?.id ?? null}
                            distMedia={distMedia}
                            setDistMedia={setDistMedia}
                        />
                    )}
                </div>

                <DistrictAsidePanel
                    showGallery={showGallery}
                    onToggleGallery={toggleGallery}
                    isAdmin={isAdmin}
                    editing={editingDistrict}
                    saving={savingDistrict}
                    error={districtError}
                    onEdit={() => isAdmin && setEditingDistrict(true)}
                    onCancel={handleCancelEdit}
                    onSave={handleDistrictSave}
                    districtNameFallback={districtNameFallback}
                    distName={distName}
                    setDistName={setDistName}
                    distPopulation={distPopulation}
                    setDistPopulation={setDistPopulation}
                    distMunicipalities={distMunicipalities}
                    setDistMunicipalities={setDistMunicipalities}
                    distParishes={distParishes}
                    setDistParishes={setDistParishes}
                    distInhabitedSince={distInhabitedSince}
                    setDistInhabitedSince={setDistInhabitedSince}
                    distDescription={distDescription}
                    setDistDescription={setDistDescription}
                    distHistory={distHistory}
                    setDistHistory={setDistHistory}
                />
            </div>

            <PoiModal
                open={showPoiModal}
                onClose={() => {
                    setShowPoiModal(false);
                    setSelectedPoi(null);
                    setPoiInfo(null);
                    setPreloadInfo(null);
                    setPreloadItems([]);
                    setLoadingPoi(false);
                    preloadProgressRef.current = null;
                    preloadOpenedRef.current = false;
                }}
                info={poiInfo}
                poi={selectedPoi}
                onSaved={(patch) => onPoiUpdated?.(patch)}
                isAdmin={isAdmin}
            />

            {(loadingPoi || loadingGallery) && (
                <SpinnerOverlay
                    open={loadingPoi || loadingGallery}
                    message={loadingPoi ? "A carregar…" : "A carregar galeria…"}
                />
            )}
        </div>
    );
}