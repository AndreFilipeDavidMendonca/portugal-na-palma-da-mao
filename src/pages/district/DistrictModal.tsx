// src/pages/district/DistrictModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import { type PoiInfo, fetchPoiInfo } from "@/lib/poiInfo";
import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";
import { type DistrictInfo, fetchDistrictInfoById } from "@/lib/districtInfo";
import { normalizeCat } from "@/utils/poiCategory";

import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import PoiFiltersMobileDropdown from "@/features/filters/PoiFilter/PoiFiltersMobileDropdown";

import DistrictAsidePanel from "@/components/DistrictAsidePanel/DistrictAsidePanel";
import DistrictMapPane from "@/components/DistrictMapPane/DistrictMapPane";
import { fetchPoiById, type PoiDto } from "@/lib/api";

import "./DistrictModal.scss";

type AnyGeo = any;

type Props = {
    open: boolean;
    onClose: () => void;

    districtFeature: AnyGeo | null;

    selectedTypes: ReadonlySet<PoiCategory>;
    onToggleType: (k: PoiCategory) => void;
    onClearTypes: () => void;

    poiPoints: AnyGeo | null;
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
    countsByCat?: Partial<Record<PoiCategory, number>>;
};

type PoiCacheEntry = { info: PoiInfo; updatedAt: number };

const uniqStrings = (arr: string[]) =>
    Array.from(new Set((arr ?? []).filter(Boolean)));

const pickPoiId = (feature: any): number | null => {
    const id = feature?.properties?.id;
    return typeof id === "number" ? id : null;
};

export default function DistrictModal({
                                          open,
                                          onClose,
                                          districtFeature,
                                          selectedTypes,
                                          onToggleType,
                                          onClearTypes,
                                          poiPoints,
                                          poiAreas = null,
                                          rivers = null,
                                          lakes = null,
                                          rails = null,
                                          roads = null,
                                          countsByCat: countsByCatProp = {},
                                          onPoiUpdated,
                                          isAdmin = false,
                                      }: Props) {
    const [renderNonce, setRenderNonce] = useState(0);

    const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
    const [editingDistrict, setEditingDistrict] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);

    const [distName, setDistName] = useState("");
    const [distMedia, setDistMedia] = useState<string[]>([]);

    const [showGallery, setShowGallery] = useState(false);
    const [loadingGallery, setLoadingGallery] = useState(false);

    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);

    const [distPopulation, setDistPopulation] = useState("");
    const [distMunicipalities, setDistMunicipalities] = useState("");
    const [distParishes, setDistParishes] = useState("");
    const [distInhabitedSince, setDistInhabitedSince] = useState("");
    const [distDescription, setDistDescription] = useState("");
    const [distHistory, setDistHistory] = useState("");

    const reqRef = useRef(0);
    const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());

    const navMode = showGallery ? "back" : "home";

    const districtId = useMemo(() => {
        const id = districtFeature?.properties?.id;
        return typeof id === "number" ? id : null;
    }, [districtFeature]);

    /* ---------------- District Info (AGORA POR ID) ---------------- */

    useEffect(() => {
        let alive = true;

        (async () => {
            // só carrega quando o modal está aberto
            if (!open) return;

            if (!districtId) {
                if (alive) setDistrictInfo(null);
                return;
            }

            try {
                const info = await fetchDistrictInfoById(districtId);
                if (!alive) return;

                setDistrictInfo(info);

                // hidratar campos do aside (para não aparecer tudo “—”)
                if (info) {
                    setDistName(info.namePt ?? info.name ?? "Distrito");
                    setDistMedia(info.files ?? []);

                    setDistPopulation(
                        info.population != null ? String(info.population) : ""
                    );
                    setDistMunicipalities(
                        info.municipalities != null ? String(info.municipalities) : ""
                    );
                    setDistParishes(info.parishes != null ? String(info.parishes) : "");
                    setDistInhabitedSince(info.inhabited_since ?? "");
                    setDistDescription(info.description ?? "");
                    setDistHistory(info.history ?? "");
                } else {
                    // fallback mínimo quando não há info
                    const fallbackName =
                        districtFeature?.properties?.name ||
                        districtFeature?.properties?.NAME ||
                        "Distrito";

                    setDistName(fallbackName);
                    setDistMedia([]);

                    setDistPopulation("");
                    setDistMunicipalities("");
                    setDistParishes("");
                    setDistInhabitedSince("");
                    setDistDescription("");
                    setDistHistory("");
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

    /* ---------------- Normalize POIs ---------------- */

    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };
                const name =
                    props["name:pt"] || props.name || props["name:en"] || props.label;

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

        if (!normalizedPoints)
            return { localCountsByCat: counts, filteredPoints: null as any };

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

    const countsByCat = useMemo(() => {
        const hasAny =
            countsByCatProp && Object.values(countsByCatProp).some((v) => (v ?? 0) > 0);

        return hasAny ? countsByCatProp : localCountsByCat;
    }, [countsByCatProp, localCountsByCat]);

    /* ---------------- Map Key ---------------- */

    const filterKey = useMemo(
        () => Array.from(selectedTypes).sort().join("|"),
        [selectedTypes]
    );

    /* ---------------- POI Modal Logic ---------------- */

    useEffect(() => {
        let alive = true;

        (async () => {
            if (!selectedPoi?.properties) return;

            const reqId = ++reqRef.current;

            setLoadingPoi(true);
            setShowPoiModal(false);

            const poiId = pickPoiId(selectedPoi);
            if (!poiId) {
                setLoadingPoi(false);
                return;
            }

            // Cache first
            const cached = poiCacheRef.current.get(poiId);
            if (cached && alive && reqRef.current === reqId) {
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
                        tags: {
                            category: dto.category,
                            subcategory: dto.subcategory ?? null,
                        },
                    },
                };

                const base = await fetchPoiInfo({ sourceFeature: featureFull });

                if (!alive || reqRef.current !== reqId) return;
                if (!base) return;

                // (mantém a tua lógica de imagens se quiseres)
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

    return (
        <div className="district-modal theme-dark">
            <div className="poi-top">
                <PoiFiltersMobileDropdown
                    navMode={navMode}
                    onNav={onClose}
                    selected={selectedTypes}
                    onToggle={onToggleType}
                    onClear={onClearTypes}
                    countsByCat={countsByCat}
                />

                <PoiFilter
                    variant="top"
                    navMode={navMode}
                    onNav={onClose}
                    selected={selectedTypes}
                    onToggle={onToggleType}
                    onClear={onClearTypes}
                    countsByCat={countsByCat}
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

                <DistrictAsidePanel
                    showGallery={showGallery}
                    onToggleGallery={() => setShowGallery((prev) => !prev)}
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
                        // mantém a tua lógica de save (quando ligares updateDistrict)
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

            {(loadingPoi || loadingGallery) && (
                <SpinnerOverlay
                    open={loadingPoi || loadingGallery}
                    message="A carregar…"
                />
            )}
        </div>
    );
}