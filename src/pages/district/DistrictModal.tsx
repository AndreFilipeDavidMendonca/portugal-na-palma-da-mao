// src/pages/district/DistrictModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import { normalizeCat } from "@/utils/poiCategory";
import { fetchPoisLiteBbox, fetchPoiById, type PoiDto, updateDistrict } from "@/lib/api";
import { type PoiInfo, fetchPoiInfo } from "@/lib/poiInfo";
import { type DistrictInfo, fetchDistrictInfoById } from "@/lib/districtInfo";

import { toast } from "@/components/Toastr/toast";

import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";
import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import PoiFiltersMobileDropdown from "@/features/filters/PoiFilter/PoiFiltersMobileDropdown";
import DistrictAsidePanel from "@/components/DistrictAsidePanel/DistrictAsidePanel";
import DistrictMapPane from "@/components/DistrictMapPane/DistrictMapPane";
import DistrictGalleryPane from "@/components/DistrictGalleryPane/DistrictGalleryPane";
import { filterPointsInsideDistrict } from "@/lib/spatial";

import "./DistrictModal.scss";

type AnyGeo = any;

type Props = {
    open: boolean;
    onClose: () => void;
    districtFeature: AnyGeo | null;

    poiAreas?: AnyGeo | null;
    rivers?: AnyGeo | null;
    lakes?: AnyGeo | null;
    rails?: AnyGeo | null;
    roads?: AnyGeo | null;

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

const EMPTY_FC = { type: "FeatureCollection", features: [] as any[] };

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

const pickPoiId = (feature: any): number | null => {
    const id = feature?.properties?.id;
    if (typeof id === "number" && Number.isFinite(id)) return id;
    if (typeof id === "string") {
        const n = Number(id.trim());
        return Number.isFinite(n) ? n : null;
    }
    return null;
};

function pickDistrictId(feature: any): number | null {
    const p = feature?.properties ?? {};
    const candidates = [p.districtDbId, p.id, p.ID, p.districtId, p.DISTRICT_ID, p.distritoId];
    for (const raw of candidates) {
        if (typeof raw === "number" && Number.isFinite(raw)) return raw;
        if (typeof raw === "string") {
            const n = Number(raw.trim());
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

function bboxFromFeature(feature: any): string | null {
    try {
        const b = L.geoJSON(feature).getBounds();
        if (!b.isValid()) return null;
        return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    } catch {
        return null;
    }
}

function dtoToPointFeature(p: any) {
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
            id: p.id,
            name: p.name,
            namePt: p.namePt ?? p.name,
            category: p.category ?? null,
            ownerId: p.ownerId ?? null,
        },
    };
}

function normalizePoints(fc: AnyGeo | null) {
    if (!fc) return EMPTY_FC;

    const feats = (fc.features ?? [])
        .map((f: any) => {
            const props = { ...(f.properties || {}) };
            const name = props["name:pt"] || props.name || props["name:en"] || props.label;
            if (!name) return null;

            const cat = normalizeCat(props.category);
            return {
                ...f,
                properties: {
                    ...props,
                    __cat: cat ?? null,
                    category: cat ?? props.category ?? null,
                },
            };
        })
        .filter(Boolean);

    return { ...fc, features: feats };
}

export default function DistrictModal({
                                          open,
                                          onClose,
                                          districtFeature,
                                          poiAreas = null,
                                          rivers = null,
                                          lakes = null,
                                          rails = null,
                                          roads = null,
                                          onPoiUpdated,
                                          isAdmin = false,
                                      }: Props) {
    const [renderNonce, setRenderNonce] = useState(0);

    // filters
    const [selectedTypes, setSelectedTypes] = useState<Set<PoiCategory>>(new Set());
    const togglePoiType = useCallback((k: PoiCategory) => {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }, []);
    const clearPoiTypes = useCallback(() => setSelectedTypes(new Set()), []);

    const districtId = useMemo(() => pickDistrictId(districtFeature), [districtFeature]);
    const activeBbox = useMemo(() => (districtFeature ? bboxFromFeature(districtFeature) : null), [districtFeature]);

    // District info
    const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);

    // Aside fields
    const [editingDistrict, setEditingDistrict] = useState(false);
    const [savingDistrict, setSavingDistrict] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);

    const [distName, setDistName] = useState("");
    const [distMedia, setDistMedia] = useState<string[]>([]);
    const [distPopulation, setDistPopulation] = useState("");
    const [distMunicipalities, setDistMunicipalities] = useState("");
    const [distParishes, setDistParishes] = useState("");
    const [distInhabitedSince, setDistInhabitedSince] = useState("");
    const [distDescription, setDistDescription] = useState("");
    const [distHistory, setDistHistory] = useState("");

    // Gallery
    const [showGallery, setShowGallery] = useState(false);
    const [loadingGallery, setLoadingGallery] = useState(false);

    // POIs base (1 fetch por distrito)
    const [poiBase, setPoiBase] = useState<AnyGeo>(EMPTY_FC);
    const poisReqRef = useRef(0);

    // POI modal
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const poiModalReqRef = useRef(0);
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());

    const navMode: "home" | "back" = showGallery ? "back" : "home";

    const districtNameFallback = useMemo(() => {
        return (
            districtFeature?.properties?.name ||
            districtFeature?.properties?.NAME ||
            "Distrito"
        );
    }, [districtFeature]);

    const applyDistrictInfo = useCallback(
        (info: DistrictInfo | null) => {
            setDistrictInfo(info);

            if (!info) {
                setDistName(districtNameFallback);
                setDistMedia([]);
                setDistPopulation("");
                setDistMunicipalities("");
                setDistParishes("");
                setDistInhabitedSince("");
                setDistDescription("");
                setDistHistory("");
                return;
            }

            setDistName(info.namePt ?? info.name ?? districtNameFallback);
            setDistMedia((info.files ?? []).slice(0, 10));
            setDistPopulation(info.population != null ? String(info.population) : "");
            setDistMunicipalities(info.municipalities != null ? String(info.municipalities) : "");
            setDistParishes(info.parishes != null ? String(info.parishes) : "");
            setDistInhabitedSince(info.inhabited_since ?? "");
            setDistDescription(info.description ?? "");
            setDistHistory(info.history ?? "");
        },
        [districtNameFallback]
    );

    // Reset “session”
    useEffect(() => {
        if (!open) return;

        setSelectedTypes(new Set());
        setPoiBase(EMPTY_FC);

        setDistrictError(null);
        setEditingDistrict(false);
        setSavingDistrict(false);
        setShowGallery(false);

        setSelectedPoi(null);
        setPoiInfo(null);
        setShowPoiModal(false);
        setLoadingPoi(false);
        setLoadingGallery(false);

        setRenderNonce((n) => n + 1);
    }, [open, districtId]);

    // Load district info
    useEffect(() => {
        let alive = true;

        (async () => {
            if (!open) return;

            if (!districtId) {
                if (!alive) return;
                applyDistrictInfo(null);
                return;
            }

            try {
                const info = await fetchDistrictInfoById(districtId);
                if (!alive) return;
                applyDistrictInfo(info);
            } catch (e) {
                console.error("[DistrictModal] erro a carregar distrito:", e);
                if (!alive) return;
                setDistrictInfo(null);
            }
        })();

        return () => {
            alive = false;
        };
    }, [open, districtId, applyDistrictInfo]);

    // Fetch POIs base
    useEffect(() => {
        if (!open) return;

        if (!activeBbox) {
            setPoiBase(EMPTY_FC);
            return;
        }

        const reqId = ++poisReqRef.current;
        const controller = new AbortController();

        (async () => {
            try {
                const limit = 5000;
                const res = await fetchPoisLiteBbox(activeBbox, { limit, signal: controller.signal });
                if (poisReqRef.current !== reqId) return;

                setPoiBase({
                    type: "FeatureCollection",
                    features: (res.pois ?? []).map(dtoToPointFeature),
                });
            } catch (e: any) {
                if (e?.name !== "AbortError") console.error("[DistrictModal] erro ao buscar POIs:", e);
            }
        })();

        return () => controller.abort();
    }, [open, activeBbox]);

    // Normalize + clip
    const clippedPoints = useMemo(() => {
        const normalized = normalizePoints(poiBase);
        return filterPointsInsideDistrict(normalized, districtFeature);
    }, [poiBase, districtFeature]);

    // Counts + filtered points
    const { countsByCat, filteredPoints } = useMemo(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        const featsAll = (clippedPoints?.features ?? []) as any[];
        for (const f of featsAll) {
            const cat = (f?.properties as any)?.__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
        }

        const hasFilter = selectedTypes.size > 0;
        const featsForMap = !hasFilter
            ? []
            : featsAll.filter((f) => {
                const cat = (f?.properties as any)?.__cat as PoiCategory | undefined;
                return cat ? selectedTypes.has(cat) : false;
            });

        return {
            countsByCat: counts,
            filteredPoints: { type: "FeatureCollection", features: featsForMap },
        };
    }, [clippedPoints, selectedTypes]);

    const filterKey = useMemo(() => Array.from(selectedTypes).sort().join("|"), [selectedTypes]);

    // POI modal logic
    useEffect(() => {
        let alive = true;

        (async () => {
            if (!selectedPoi?.properties) return;

            const reqId = ++poiModalReqRef.current;
            setLoadingPoi(true);
            setShowPoiModal(false);

            const poiId = pickPoiId(selectedPoi);
            if (!poiId) {
                setLoadingPoi(false);
                return;
            }

            const cached = poiCacheRef.current.get(poiId);
            if (cached && alive && poiModalReqRef.current === reqId) {
                setPoiInfo(cached.info);
                setShowPoiModal(true);
                setLoadingPoi(false);
                return;
            }

            try {
                const dto: PoiDto | null = await fetchPoiById(poiId);
                if (!dto) return;

                const featureFull = {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [dto.lon, dto.lat] },
                    properties: {
                        ...dto,
                        id: dto.id,
                        poiId: dto.id,
                        namePt: dto.namePt ?? dto.name,
                        tags: { category: dto.category, subcategory: dto.subcategory ?? null },
                    },
                };

                const base = await fetchPoiInfo({ sourceFeature: featureFull });
                if (!alive || poiModalReqRef.current !== reqId) return;
                if (!base) return;

                const merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);
                const infoNow: PoiInfo = { ...base, image: merged[0] ?? base.image ?? null, images: merged };

                setPoiInfo(infoNow);
                setShowPoiModal(true);
                poiCacheRef.current.set(poiId, { info: infoNow, updatedAt: Date.now() });
            } catch (err) {
                console.error("Erro ao buscar POI full:", err);
            } finally {
                if (alive) setLoadingPoi(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi]);

    const handleNav = useCallback(() => {
        if (showGallery) {
            setShowGallery(false);
            return;
        }
        onClose();
    }, [showGallery, onClose]);

    const onAnySelection = useCallback(() => {
        if (showGallery) setShowGallery(false);
    }, [showGallery]);

    const handleCancel = useCallback(() => {
        setEditingDistrict(false);
        setDistrictError(null);
        applyDistrictInfo(districtInfo); // ✅ sem repetição
    }, [districtInfo, applyDistrictInfo]);

    const buildPayload = useCallback(() => {
        return {
            namePt: distName || null,
            name: distName || null,
            population: distPopulation ? Number(distPopulation) : null,
            municipalities: distMunicipalities ? Number(distMunicipalities) : null,
            parishes: distParishes ? Number(distParishes) : null,
            inhabited_since: distInhabitedSince || null,
            description: distDescription || null,
            history: distHistory || null,
            files: (distMedia ?? []).slice(0, 10),
        };
    }, [
        distName,
        distPopulation,
        distMunicipalities,
        distParishes,
        distInhabitedSince,
        distDescription,
        distHistory,
        distMedia,
    ]);

    const handleSave = useCallback(async () => {
        if (!districtId) {
            toast.error("Distrito inválido.");
            return;
        }

        setSavingDistrict(true);
        setDistrictError(null);

        try {
            const payload = buildPayload();
            const updated = await updateDistrict(districtId, payload);

            // Atualiza estado local (para UI imediata)
            setDistrictInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        ...updated,
                        files: (updated?.files ?? payload.files ?? prev.files ?? []).slice(0, 10),
                    }
                    : prev
            );

            setDistMedia((updated?.files ?? payload.files ?? distMedia ?? []).slice(0, 10));

            toast.success("Distrito guardado.");
            setEditingDistrict(false);
        } catch (e: any) {
            const msg = e?.message || "Falha ao guardar o distrito.";
            setDistrictError(msg);
            toast.error(msg);
        } finally {
            setSavingDistrict(false);
        }
    }, [districtId, buildPayload, distMedia]);

    if (!open) return null;

    const districtNameForGallery =
        distName ||
        districtInfo?.namePt ||
        districtInfo?.name ||
        districtNameFallback;

    const districtBaseUrls = (distMedia?.length ? distMedia : districtInfo?.files ?? []).slice(0, 10);

    return (
        <div className="district-modal theme-dark">
            <div className="poi-top">
                <PoiFiltersMobileDropdown
                    navMode={navMode}
                    onNav={handleNav}
                    selected={selectedTypes}
                    onToggle={togglePoiType}
                    onClear={clearPoiTypes}
                    countsByCat={countsByCat}
                    onAnySelection={onAnySelection}
                />

                <PoiFilter
                    variant="top"
                    navMode={navMode}
                    onNav={handleNav}
                    selected={selectedTypes}
                    onToggle={togglePoiType}
                    onClear={clearPoiTypes}
                    countsByCat={countsByCat}
                    onAnySelection={onAnySelection}
                />
            </div>

            <div className="modal-content">
                <div className="left-pane">
                    {!showGallery ? (
                        <DistrictMapPane
                            key={filterKey}
                            districtFeature={districtFeature}
                            rivers={rivers}
                            lakes={lakes}
                            rails={rails}
                            roads={roads}
                            poiAreas={poiAreas}
                            filteredPoints={filteredPoints}
                            selectedTypes={selectedTypes}
                            renderNonce={renderNonce}
                            onPoiClick={setSelectedPoi}
                        />
                    ) : (
                        <DistrictGalleryPane
                            open={showGallery}
                            districtName={districtNameForGallery}
                            baseUrls={districtBaseUrls}
                            onClose={() => setShowGallery(false)}
                            setLoading={setLoadingGallery}
                            editing={editingDistrict}
                            isAdmin={isAdmin}
                            distMedia={distMedia}
                            setDistMedia={setDistMedia}
                        />
                    )}
                </div>

                <div className="right-pane">
                    <DistrictAsidePanel
                        showGallery={showGallery}
                        onToggleGallery={() => setShowGallery((prev) => !prev)}
                        isAdmin={isAdmin}
                        editing={editingDistrict}
                        saving={savingDistrict}
                        error={districtError}
                        onEdit={() => isAdmin && setEditingDistrict(true)}
                        onCancel={handleCancel}
                        onSave={handleSave}

                        districtNameFallback={distName}
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
                        distMedia={distMedia}
                        setDistMedia={setDistMedia}
                    />
                </div>
            </div>

            <PoiModal
                open={showPoiModal}
                onClose={() => {
                    setShowPoiModal(false);
                    setSelectedPoi(null);
                }}
                info={poiInfo}
                poi={selectedPoi}
                onSaved={(patch) => onPoiUpdated?.(patch)}
                isAdmin={isAdmin}
            />

            {(loadingPoi || loadingGallery || savingDistrict) && (
                <SpinnerOverlay
                    open={loadingPoi || loadingGallery || savingDistrict}
                    message="A carregar…"
                />
            )}
        </div>
    );
}