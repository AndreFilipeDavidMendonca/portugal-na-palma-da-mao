// src/pages/district/DistrictModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import { normalizeCat } from "@/utils/poiCategory";
import { fetchPoisLiteBbox, fetchPoiById, type PoiDto } from "@/lib/api";
import { type PoiInfo, fetchPoiInfo } from "@/lib/poiInfo";
import { type DistrictInfo, fetchDistrictInfoById } from "@/lib/districtInfo";

import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";
import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import PoiFiltersMobileDropdown from "@/features/filters/PoiFilter/PoiFiltersMobileDropdown";
import DistrictAsidePanel from "@/components/DistrictAsidePanel/DistrictAsidePanel";
import DistrictMapPane from "@/components/DistrictMapPane/DistrictMapPane";


import "./DistrictModal.scss";
import DistrictGallery from "@/components/DistrictGalleryPane/DistrictGalleryPane";

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
    const candidates = [
        p.districtDbId, // ✅ primeiro
        p.id,
        p.ID,
        p.districtId,
        p.DISTRICT_ID,
        p.distritoId,
    ];

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
        const gj = L.geoJSON(feature);
        const b = gj.getBounds();
        if (!b.isValid()) return null;
        return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
    } catch {
        return null;
    }
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

    // 🔥 filtros vivem aqui
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

    // POIs (lite) + counts
    const [poiPoints, setPoiPoints] = useState<AnyGeo | null>(null);
    const [countsByCat, setCountsByCat] = useState<Partial<Record<PoiCategory, number>>>({});

    // refs separados (evita race conditions)
    const poisReqRef = useRef(0);
    const poiModalReqRef = useRef(0);

    // POI modal (inside district)
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());

    const navMode = showGallery ? "back" : "home";

    // reset clean ao abrir novo distrito
    useEffect(() => {
        if (!open) return;

        setSelectedTypes(new Set());
        setPoiPoints({ type: "FeatureCollection", features: [] });
        setCountsByCat({});
        setSelectedPoi(null);
        setPoiInfo(null);
        setShowPoiModal(false);
        setDistrictError(null);
        setEditingDistrict(false);
        setShowGallery(false); // ✅ garantir que abre sempre no painel normal

        setRenderNonce((n) => n + 1);
    }, [open, districtId]);

    // 1) Load district data by ID
    useEffect(() => {
        let alive = true;

        (async () => {
            if (!open) return;

            if (!districtId) {
                setDistrictInfo(null);

                const fallback = districtFeature?.properties?.name || districtFeature?.properties?.NAME || "Distrito";

                setDistName(fallback);
                setDistMedia([]);
                setDistPopulation("");
                setDistMunicipalities("");
                setDistParishes("");
                setDistInhabitedSince("");
                setDistDescription("");
                setDistHistory("");
                return;
            }

            try {
                const info = await fetchDistrictInfoById(districtId);
                if (!alive) return;

                setDistrictInfo(info);

                if (info) {
                    setDistName(info.namePt ?? info.name ?? "Distrito");
                    setDistMedia(info.files ?? []);
                    setDistPopulation(info.population != null ? String(info.population) : "");
                    setDistMunicipalities(info.municipalities != null ? String(info.municipalities) : "");
                    setDistParishes(info.parishes != null ? String(info.parishes) : "");
                    setDistInhabitedSince(info.inhabited_since ?? "");
                    setDistDescription(info.description ?? "");
                    setDistHistory(info.history ?? "");
                }
            } catch (e) {
                console.error("[DistrictModal] erro a carregar distrito:", e);
                if (!alive) return;
                setDistrictInfo(null);
            }
        })();

        return () => {
            alive = false;
        };
    }, [open, districtId, districtFeature]);

    // 2) Load counts (sempre) + POIs (dependente de filtro)
    useEffect(() => {
        if (!open) return;

        if (!activeBbox) {
            setPoiPoints({ type: "FeatureCollection", features: [] });
            setCountsByCat({});
            return;
        }

        const reqId = ++poisReqRef.current;
        const controller = new AbortController();

        (async () => {
            try {
                const limit = 5000;

                // counts (limit=1)
                const countsRes = await fetchPoisLiteBbox(activeBbox, {
                    limit: 1,
                    signal: controller.signal,
                });
                if (poisReqRef.current !== reqId) return;

                const nextCounts: Partial<Record<PoiCategory, number>> = {};
                for (const [k, v] of Object.entries(countsRes.countsByCategory ?? {})) {
                    nextCounts[k as PoiCategory] = Number(v ?? 0);
                }
                setCountsByCat(nextCounts);

                // POIs
                const selected = Array.from(selectedTypes);

                if (selected.length === 0) {
                    setPoiPoints({ type: "FeatureCollection", features: [] });
                    return;
                }

                if (selected.length === 1) {
                    const res = await fetchPoisLiteBbox(activeBbox, {
                        category: selected[0],
                        limit,
                        signal: controller.signal,
                    });
                    if (poisReqRef.current !== reqId) return;

                    setPoiPoints({
                        type: "FeatureCollection",
                        features: res.pois.map((p) => ({
                            type: "Feature",
                            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
                            properties: {
                                id: p.id,
                                name: p.name,
                                namePt: p.namePt ?? p.name,
                                category: p.category,
                                ownerId: p.ownerId,
                            },
                        })),
                    });
                    return;
                }

                const res = await fetchPoisLiteBbox(activeBbox, {
                    limit,
                    signal: controller.signal,
                });
                if (poisReqRef.current !== reqId) return;

                const sel = new Set(selected);

                setPoiPoints({
                    type: "FeatureCollection",
                    features: res.pois
                        .filter((p) => p.category && sel.has(p.category as PoiCategory))
                        .map((p) => ({
                            type: "Feature",
                            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
                            properties: {
                                id: p.id,
                                name: p.name,
                                namePt: p.namePt ?? p.name,
                                category: p.category,
                                ownerId: p.ownerId,
                            },
                        })),
                });
            } catch (e: any) {
                if (e?.name !== "AbortError") console.error("[DistrictModal] erro ao buscar POIs:", e);
            }
        })();

        return () => controller.abort();
    }, [open, activeBbox, selectedTypes]);

    // 3) Normalize POIs
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };
                const name = props["name:pt"] || props.name || props["name:en"] || props.label;
                if (!name) return null;

                const nf = { ...f, properties: { ...props } };
                const cat = normalizeCat(props.category);
                if (cat) {
                    (nf.properties as any).__cat = cat;
                    (nf.properties as any).category = cat;
                }
                return nf;
            })
            .filter(Boolean);

        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    const { localCountsByCat, filteredPoints } = useMemo(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        if (!normalizedPoints) return { localCountsByCat: counts, filteredPoints: null as any };

        const hasFilter = selectedTypes.size > 0;
        const feats: any[] = [];

        for (const f of normalizedPoints.features ?? []) {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;

            if (!hasFilter) feats.push(f);
            else if (cat && selectedTypes.has(cat)) feats.push(f);
        }

        return {
            localCountsByCat: counts,
            filteredPoints: { ...normalizedPoints, features: feats },
        };
    }, [normalizedPoints, selectedTypes]);

    const effectiveCountsByCat = useMemo(() => {
        const hasAny = Object.values(countsByCat ?? {}).some((v) => (v ?? 0) > 0);
        return hasAny ? countsByCat : localCountsByCat;
    }, [countsByCat, localCountsByCat]);

    const filterKey = useMemo(() => Array.from(selectedTypes).sort().join("|"), [selectedTypes]);

    // 4) POI Modal logic
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

    if (!open) return null;

    const districtNameForGallery =
        distName ||
        districtInfo?.namePt ||
        districtInfo?.name ||
        districtFeature?.properties?.name ||
        districtFeature?.properties?.NAME ||
        "Distrito";

    const districtBaseUrls = (districtInfo?.files ?? distMedia) || [];

    return (
        <div className="district-modal theme-dark">
            <div className="poi-top">
                <PoiFiltersMobileDropdown
                    navMode={navMode}
                    onNav={onClose}
                    selected={selectedTypes}
                    onToggle={togglePoiType}
                    onClear={clearPoiTypes}
                    countsByCat={effectiveCountsByCat}
                />

                <PoiFilter
                    variant="top"
                    navMode={navMode}
                    onNav={onClose}
                    selected={selectedTypes}
                    onToggle={togglePoiType}
                    onClear={clearPoiTypes}
                    countsByCat={effectiveCountsByCat}
                />
            </div>

            <div className="modal-content">
                <div className="left-pane">
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
                </div>

                <div className="right-pane">
                    {!showGallery ? (
                        <DistrictAsidePanel
                            showGallery={showGallery}
                            onToggleGallery={() => setShowGallery(true)}
                            isAdmin={isAdmin}
                            editing={editingDistrict}
                            saving={false}
                            error={districtError}
                            onEdit={() => isAdmin && setEditingDistrict(true)}
                            onCancel={() => {
                                setEditingDistrict(false);
                                setDistrictError(null);
                            }}
                            onSave={async () => {
                                // liga aqui o updateDistrict quando quiseres
                            }}
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
                        />
                    ) : (
                        <DistrictGallery
                            open={showGallery}
                            districtName={districtNameForGallery}
                            baseUrls={districtBaseUrls}
                            onClose={() => setShowGallery(false)}
                            setLoading={setLoadingGallery}
                        />
                    )}
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

            {(loadingPoi || loadingGallery) && <SpinnerOverlay open={loadingPoi || loadingGallery} message="A carregar…" />}
        </div>
    );
}