// src/pages/district/DistrictModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadGeo } from "@/lib/geo";
import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";

import { fetchDistrictById, updateDistrict } from "@/lib/api";
import { type DistrictInfo, fetchDistrictInfo } from "@/lib/districtInfo";

import { getDistrictCommonsGallery } from "@/lib/wikimedia";
import { searchWikimediaIfAllowed } from "@/lib/wikiGate";
import { normalizeCat } from "@/utils/poiCategory";

import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import PoiFiltersMobileDropdown from "@/features/filters/PoiFilter/PoiFiltersMobileDropdown";

import DistrictAsidePanel from "@/components/DistrictAsidePanel/DistrictAsidePanel";
import DistrictGalleryPane from "@/components/DistrictGalleryPane/DistrictGalleryPane";
import DistrictMapPane from "@/components/DistrictMapPane/DistrictMapPane";

import "./DistrictModal.scss";

type AnyGeo = any;

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

type PoiCacheEntry = { info: PoiInfo; updatedAt: number };

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

const pickPoiLabel = (feature: any): string | null => {
    const p = feature?.properties ?? {};
    const label = p.namePt ?? p["name:pt"] ?? p.name ?? p["name:en"] ?? p.label ?? null;
    return typeof label === "string" && label.trim().length >= 3 ? label.trim() : null;
};

const pickPoiId = (feature: any): number | null => {
    const id = feature?.properties?.id;
    return typeof id === "number" ? id : null;
};

const mergeMedia10 = (base: string[], extra: string[]) =>
    uniqStrings([...base, ...extra]).slice(0, 10);

async function safeLoadGeoParts(paths: string[]): Promise<any | null> {
    try {
        const parts = await Promise.all(paths.map((p) => loadGeo(p)));
        const features = parts.flatMap((p: any) => p?.features ?? []);
        return features.length ? { type: "FeatureCollection", features } : null;
    } catch {
        return null;
    }
}

export default function DistrictModal({
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
                                      }: Props) {
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    /* ---------------- Map layers ---------------- */
    const [renderNonce, setRenderNonce] = useState(0);

    const [rivers, setRivers] = useState<any>(riversProp);
    const [lakes, setLakes] = useState<any>(lakesProp);
    const [rails, setRails] = useState<any>(railsProp);
    const [roads, setRoads] = useState<any>(roadsProp);

    /* ---------------- District info ---------------- */
    const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
    const [editingDistrict, setEditingDistrict] = useState(false);
    const [savingDistrict, setSavingDistrict] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);

    const [distName, setDistName] = useState("");
    const [distPopulation, setDistPopulation] = useState("");
    const [distMunicipalities, setDistMunicipalities] = useState("");
    const [distParishes, setDistParishes] = useState("");
    const [distInhabitedSince, setDistInhabitedSince] = useState("");
    const [distDescription, setDistDescription] = useState("");
    const [distHistory, setDistHistory] = useState("");
    const [distMedia, setDistMedia] = useState<string[]>([]);

    const [showGallery, setShowGallery] = useState(false);
    const [loadingGallery, setLoadingGallery] = useState(false);

    const districtNameFallback =
        (districtFeature?.properties?.name as string | undefined) || "Distrito";

    /* ---------------- POI modal ---------------- */
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);

    const reqRef = useRef(0);
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());
    const poiInflightRef = useRef<Map<number, Promise<PoiInfo | null>>>(new Map());

    const navMode = showGallery ? "back" : "home";

    const resetPoiState = useCallback(() => {
        setSelectedPoi(null);
        setPoiInfo(null);
        setShowPoiModal(false);
        setLoadingPoi(false);
    }, []);

    const goHome = useCallback(() => {
        setShowGallery(false);
        setEditingDistrict(false);
        setDistrictError(null);
        resetPoiState();
        onClose();
    }, [onClose, resetPoiState]);

    const goBackToMap = useCallback(() => {
        setShowGallery(false);
        setEditingDistrict(false);
        setDistrictError(null);
        setLoadingGallery(false);

        // ✅ Ajuda a re-montar layers e voltar a disparar o “auto-open tooltips” no PoiPointsLayer
        setRenderNonce((n) => n + 1);
    }, []);

    const onNavPress = useCallback(() => {
        if (navMode === "back") goBackToMap();
        else goHome();
    }, [navMode, goBackToMap, goHome]);

    /* ---------------- Reset when closed ---------------- */
    useEffect(() => {
        if (!open) {
            setShowGallery(false);
            setEditingDistrict(false);
            setDistrictError(null);
            setLoadingGallery(false);
            resetPoiState();
            return;
        }

        // ✅ Ao abrir o modal, força “fresh mount” no layer e tooltips (quando fizer zoom-in)
        setRenderNonce((n) => n + 1);
    }, [open, resetPoiState]);

    /* ---------------- Load district info ---------------- */
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

    /* ---------------- Sync districtInfo -> local editable fields ---------------- */
    useEffect(() => {
        const baseName =
            (districtFeature?.properties?.name as string | undefined) ||
            districtInfo?.namePt ||
            districtInfo?.name ||
            "Distrito";

        setDistName(baseName);

        if (districtInfo) {
            setDistPopulation(districtInfo.population != null ? String(districtInfo.population) : "");
            setDistMunicipalities(
                districtInfo.municipalities != null ? String(districtInfo.municipalities) : ""
            );
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

    /* ---------------- Lazy load geo layers (only if not provided) ---------------- */
    useEffect(() => {
        if (!riversProp) safeLoadGeoParts(["/geo/rios_pt1.geojson", "/geo/rios_pt2.geojson"]).then((v) => aliveRef.current && setRivers(v));
        if (!lakesProp) safeLoadGeoParts(["/geo/lagos_pt1.geojson", "/geo/lagos_pt2.geojson"]).then((v) => aliveRef.current && setLakes(v));
        if (!railsProp) safeLoadGeoParts(["/geo/ferrovias_pt1.geojson", "/geo/ferrovias_pt2.geojson"]).then((v) => aliveRef.current && setRails(v));
        if (!roadsProp) safeLoadGeoParts(["/geo/estradas_pt1.geojson", "/geo/estradas_pt2.geojson"]).then((v) => aliveRef.current && setRoads(v));
    }, [riversProp, lakesProp, railsProp, roadsProp]);

    /* ---------------- Normalize POIs ---------------- */
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };
                const name = props["name:pt"] || props.name || props["name:en"] || props.label || null;
                if (!name || typeof name !== "string" || name.trim() === "") return null;

                const nf = { ...f, properties: { ...props } as any };
                const cat = normalizeCat(props.category as unknown);
                if (cat) {
                    (nf.properties as any).__cat = cat;
                    (nf.properties as any).category = cat;
                }
                return nf;
            })
            .filter(Boolean);

        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    const { countsByCat, filteredPoints } = useMemo(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        if (!normalizedPoints) return { countsByCat: counts, filteredPoints: null as any };

        const hasFilter = selectedTypes && selectedTypes.size > 0;
        const feats: any[] = [];

        for (const f of normalizedPoints.features ?? []) {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;

            if (!hasFilter) feats.push(f);
            else if (cat && selectedTypes.has(cat)) feats.push(f);
        }

        return { countsByCat: counts, filteredPoints: { ...normalizedPoints, features: feats } };
    }, [normalizedPoints, selectedTypes]);

    const handleToggleType = useCallback(
        (k: PoiCategory) => {
            if (showGallery) goBackToMap();
            onToggleType(k);
            setRenderNonce((n) => n + 1);
        },
        [onToggleType, showGallery, goBackToMap]
    );

    const handleClearTypes = useCallback(() => {
        if (showGallery) goBackToMap();
        onClearTypes();
        setRenderNonce((n) => n + 1);
    }, [onClearTypes, showGallery, goBackToMap]);

    /* ---------------- POI open logic ---------------- */
    const buildPoiInfo = useCallback(async (feature: any): Promise<PoiInfo | null> => {
        const label = pickPoiLabel(feature);
        if (!label) return null;

        const approxLat = feature?.geometry?.coordinates?.[1];
        const approxLon = feature?.geometry?.coordinates?.[0];

        const base = await fetchPoiInfo({
            approx: {
                name: label,
                lat: typeof approxLat === "number" ? approxLat : null,
                lon: typeof approxLon === "number" ? approxLon : null,
            },
            sourceFeature: feature,
        });

        if (!base) return null;

        const baseCategory = base.category ?? null;

        let merged = mergeMedia10([base.image ?? "", ...(base.images ?? [])], []);
        if (merged.length < 10) {
            const wiki10 = await searchWikimediaIfAllowed(label, 10, baseCategory);
            merged = mergeMedia10(merged, wiki10 ?? []);
        }

        return { ...base, image: merged[0] ?? base.image ?? null, images: merged };
    }, []);

    useEffect(() => {
        let alive = true;

        (async () => {
            if (!selectedPoi?.properties) return;

            const reqId = ++reqRef.current;

            setLoadingPoi(true);
            setShowPoiModal(false);
            setPoiInfo(null);

            const poiId = pickPoiId(selectedPoi);

            if (poiId != null) {
                const cached = poiCacheRef.current.get(poiId);
                if (cached && alive && reqRef.current === reqId) {
                    setPoiInfo(cached.info);
                    setShowPoiModal(true);
                    setLoadingPoi(false);
                    return;
                }

                const inflight = poiInflightRef.current.get(poiId);
                if (inflight) {
                    const info = await inflight;
                    if (!alive || reqRef.current !== reqId) return;
                    setPoiInfo(info);
                    setShowPoiModal(Boolean(info));
                    setLoadingPoi(false);
                    return;
                }
            }

            const task = (async () => {
                try {
                    return await buildPoiInfo(selectedPoi);
                } catch {
                    return null;
                }
            })();

            if (poiId != null) poiInflightRef.current.set(poiId, task);

            const info = await task;

            if (poiId != null) poiInflightRef.current.delete(poiId);
            if (!alive || reqRef.current !== reqId) return;

            setPoiInfo(info);
            setShowPoiModal(Boolean(info));

            if (info && poiId != null) {
                poiCacheRef.current.set(poiId, { info, updatedAt: Date.now() });
            }

            setLoadingPoi(false);
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi, buildPoiInfo]);

    const onPoiClick = useCallback((feature: any) => setSelectedPoi(feature), []);

    /* ---------------- District gallery ---------------- */
    const mediaUrls = useMemo(() => {
        const uniq = uniqStrings(distMedia ?? []);

        const isVideoUrlLocal = (url: string) => {
            const namePart = url.split("#name=")[1] ?? url;
            return /\.(mp4|webm|ogg|mov|m4v)$/i.test(namePart);
        };

        const videos = uniq.filter(isVideoUrlLocal);
        const images = uniq.filter((u) => !isVideoUrlLocal(u));
        return [...videos, ...images].slice(0, 10);
    }, [distMedia]);

    const toggleGallery = useCallback(() => {
        if (showGallery) {
            goBackToMap();
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

                const nameForSearch =
                    distName || districtInfo?.namePt || districtInfo?.name || districtNameFallback;

                const firstCommons = await getDistrictCommonsGallery(nameForSearch, 3);
                let merged = uniqStrings([...dbFiles, ...firstCommons]).slice(0, 10);

                setDistMedia(merged);
                setShowGallery(true);
                setLoadingGallery(false);

                const persist = async (files: string[]) => {
                    if (!districtInfo?.id) return;
                    try {
                        const updated = await updateDistrict(districtInfo.id, { files });
                        setDistrictInfo((prev) => (prev ? { ...prev, files: updated.files ?? files } : prev));
                    } catch {
                        /* noop */
                    }
                };

                if (merged.length < 10) {
                    try {
                        const fullCommons = await getDistrictCommonsGallery(nameForSearch, 10);
                        const mergedFull = uniqStrings([...dbFiles, ...fullCommons]).slice(0, 10);

                        if (mergedFull.length > merged.length) {
                            merged = mergedFull;
                            setDistMedia(mergedFull);
                        }
                        await persist(merged);
                    } catch {
                        await persist(merged);
                    }
                } else {
                    await persist(merged);
                }
            } catch {
                setDistMedia([]);
                setShowGallery(true);
                setLoadingGallery(false);
            }
        })();
    }, [showGallery, goBackToMap, districtInfo?.id, distName, districtNameFallback]);

    if (!open) return null;

    const rootClass =
        "district-modal theme-dark" + (showGallery ? " district-modal--gallery-open" : "");

    return (
        <div className={rootClass}>
            <div className="poi-top">
                <PoiFiltersMobileDropdown
                    navMode={navMode}
                    onNav={onNavPress}
                    selected={selectedTypes}
                    onToggle={handleToggleType}
                    onClear={handleClearTypes}
                    countsByCat={countsByCat}
                    onAnySelection={() => {
                        if (showGallery) goBackToMap();
                    }}
                />

                <PoiFilter
                    variant="top"
                    navMode={navMode}
                    onNav={onNavPress}
                    selected={selectedTypes}
                    onToggle={handleToggleType}
                    onClear={handleClearTypes}
                    countsByCat={countsByCat}
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
                    onCancel={() => {
                        setEditingDistrict(false);
                        setDistrictError(null);
                        setShowGallery(false);
                    }}
                    onSave={async () => {
                        /* mantém o teu save igual */
                    }}
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
                    setLoadingPoi(false);
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