// src/pages/district/DistrictModal.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import {
    DISTRICT_DETAIL,
    DISTRICT_LABELS,
    COLOR_RIVER,
    COLOR_LAKE,
    COLOR_RAIL,
    COLOR_ROAD,
    COLOR_PEAK,
    Z_RIVERS,
    Z_LAKES,
    Z_RAIL,
    Z_ROADS,
    Z_PEAKS,
    Z_PLACES,
    POI_LABELS,
    type PoiCategory,
} from "@/utils/constants";
import { PoiAreasLayer, PoiPointsLayer } from "@/features/map/PoiLayers";
import PoiFilter from "@/features/filters/PoiFilter/PoiFilter";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import PoiModal from "@/pages/poi/PoiModal";
import SpinnerOverlay from "@/components/SpinnerOverlay";
import ImageDropField from "@/components/ImageDropField";
import MediaSlideshow from "@/components/MediaSlideshow";

import "./DistrictModal.scss";

import {
    updateDistrict,
    type DistrictUpdatePayload,
    fetchDistrictById,
} from "@/lib/api";
import {
    fetchDistrictInfo,
    type DistrictInfo,
} from "@/lib/districtInfo";
import {
    searchWikimediaImagesByName,
    loadFirstValidImages,
} from "@/lib/wikimedia";

type AnyGeo = any;

/* ---------- Fit Bounds ---------- */
function FitDistrictBounds({ feature }: { feature: AnyGeo | null }) {
    const map = useMap();
    const prevRef = useRef<string | null>(null);

    useEffect(() => {
        if (!feature) return;
        const hash = JSON.stringify(feature?.geometry);
        if (prevRef.current === hash) return;
        prevRef.current = hash;

        const gj = L.geoJSON(feature as any);
        const b = gj.getBounds();
        if (b.isValid()) {
            map.fitBounds(b.pad(0.08), { animate: true });
            map.setMaxBounds(b.pad(0.25));
        }
    }, [feature, map]);

    return null;
}

type Props = {
    open: boolean;
    onClose: () => void;
    districtFeature: AnyGeo | null;
    selectedTypes: Set<PoiCategory>;
    onToggleType: (k: PoiCategory) => void;
    onClearTypes: () => void;
    poiPoints: AnyGeo | null;
    poiAreas?: AnyGeo | null;
    population?: number | null;
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
};

const isPoiCategory = (val: any): val is PoiCategory =>
    val != null && Object.prototype.hasOwnProperty.call(POI_LABELS, val);

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
    } = props;

    /* ====== Estado POI seleccionado ====== */
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [selectedPoiInfo, setSelectedPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const [loadingGallery, setLoadingGallery] = useState(false);
    const lastReqRef = useRef(0);

    /* ====== Layers / filtros ====== */
    const [renderNonce, setRenderNonce] = useState(0);

    const [rivers, setRivers] = useState<any>(riversProp);
    const [lakes, setLakes] = useState<any>(lakesProp);
    const [rails, setRails] = useState<any>(railsProp);
    const [roads, setRoads] = useState<any>(roadsProp);
    const [peaks, setPeaks] = useState<any>(peaksProp);
    const [places, setPlaces] = useState<any>(placesProp);

    /* ====== District info (texto + meta) ====== */
    const [districtInfo, setDistrictInfo] = useState<DistrictInfo | null>(null);
    const [editingDistrict, setEditingDistrict] = useState(false);
    const [savingDistrict, setSavingDistrict] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);

    // campos editáveis
    const [distName, setDistName] = useState<string>("");
    const [distPopulation, setDistPopulation] = useState<string>("");
    const [distMunicipalities, setDistMunicipalities] =
        useState<string>("");
    const [distParishes, setDistParishes] = useState<string>("");
    const [distInhabitedSince, setDistInhabitedSince] =
        useState<string>("");
    const [distDescription, setDistDescription] = useState<string>("");
    const [distHistory, setDistHistory] = useState<string>("");
    const [distMedia, setDistMedia] = useState<string[]>([]);

    // galeria ON/OFF
    const [showGallery, setShowGallery] = useState(false);

    useEffect(() => {
        if (!open) {
            setShowGallery(false);
            setEditingDistrict(false);
            setDistrictError(null);
            setSelectedPoi(null);
            setSelectedPoiInfo(null);
        }
    }, [open]);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            if (!districtFeature?.properties?.name) {
                if (alive) setDistrictInfo(null);
                return;
            }

            try {
                const name = districtFeature.properties.name as string;
                const info = await fetchDistrictInfo(name);
                if (!alive) return;
                setDistrictInfo(info);
            } catch {
                if (alive) setDistrictInfo(null);
            }
        };

        load();
        return () => {
            alive = false;
        };
    }, [districtFeature]);

    /* ----- sincronizar districtInfo -> campos editáveis ----- */
    useEffect(() => {
        const baseName =
            (districtFeature?.properties?.name as string | undefined) ||
            districtInfo?.namePt ||
            districtInfo?.name ||
            "Distrito";

        setDistName(baseName);

        if (districtInfo) {
            setDistPopulation(
                districtInfo.population != null
                    ? String(districtInfo.population)
                    : ""
            );
            setDistMunicipalities(
                (districtInfo as any).municipalities != null
                    ? String((districtInfo as any).municipalities)
                    : ""
            );
            setDistParishes(
                (districtInfo as any).parishes != null
                    ? String((districtInfo as any).parishes)
                    : ""
            );
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

    /* ----- lazy load camadas geográficas ----- */
    useEffect(() => {
        const safeLoad = async (
            path: string,
            set: (v: any) => void,
            already: any
        ) => {
            if (already) return;
            try {
                const gj = await loadGeo(path);
                if (
                    gj &&
                    (gj.type === "FeatureCollection" || gj.type === "Feature")
                )
                    set(gj);
                else set(null);
            } catch {
                set(null);
            }
        };
        safeLoad("/geo/rios_pt.geojson", setRivers, riversProp);
        safeLoad("/geo/lagos_pt.geojson", setLakes, lakesProp);
        safeLoad("/geo/ferrovias_pt.geojson", setRails, railsProp);
        safeLoad("/geo/estradas_pt.geojson", setRoads, roadsProp);
        safeLoad("/geo/picos_pt.geojson", setPeaks, peaksProp);
        safeLoad("/geo/cidades_pt.geojson", setPlaces, placesProp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ----- Normalização + categoria simples ----- */
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };

                const name =
                    props["name:pt"] ||
                    props.name ||
                    props["name:en"] ||
                    props.label ||
                    null;

                if (!name || typeof name !== "string" || name.trim() === "")
                    return null;

                const nf = { ...f, properties: { ...props } as any };

                const rawCat = props.category as string | undefined;
                if (rawCat && isPoiCategory(rawCat)) {
                    (nf.properties as any).__cat = rawCat as PoiCategory;
                }

                return nf;
            })
            .filter(Boolean);

        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    /* ----- Contagens para o filtro ----- */
    const countsByCat = useMemo<Record<PoiCategory, number>>(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;
        for (const f of normalizedPoints?.features ?? []) {
            const cat = (f.properties as any).__cat as
                | PoiCategory
                | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalizedPoints]);

    /* ----- Aplicar filtros por seleção ----- */
    const filteredPoints = useMemo(() => {
        if (!normalizedPoints) return null;
        if (!selectedTypes || selectedTypes.size === 0)
            return normalizedPoints;
        const feats = normalizedPoints.features.filter((f: any) => {
            const cat = (f.properties as any).__cat as
                | PoiCategory
                | undefined;
            return cat ? selectedTypes.has(cat) : false;
        });
        return { ...normalizedPoints, features: feats };
    }, [normalizedPoints, selectedTypes]);

    /* ====== Clique num ponto ====== */
    const onPoiClick = (feature: any) => {
        setSelectedPoi(feature);
    };

    /* ====== Fetch PoiInfo ====== */
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!selectedPoi?.properties) return;

            setShowPoiModal(false);
            setSelectedPoiInfo(null);
            setLoadingPoi(true);
            const reqId = ++lastReqRef.current;

            try {
                const approxName =
                    selectedPoi.properties["name:pt"] ??
                    selectedPoi.properties.name ??
                    null;
                const approxLat = selectedPoi.geometry?.coordinates?.[1];
                const approxLon = selectedPoi.geometry?.coordinates?.[0];

                const info = await fetchPoiInfo({
                    approx: { name: approxName, lat: approxLat, lon: approxLon },
                    sourceFeature: selectedPoi,
                });
                if (!alive || reqId !== lastReqRef.current) return;

                setSelectedPoiInfo(info);

                const hasAnyImage = !!(
                    info?.image || (info?.images?.length ?? 0) > 0
                );
                const hasTitle = !!info?.label;
                const hasDesc =
                    !!info?.description &&
                    info!.description!.trim().length > 0;
                const shouldOpen = hasTitle || hasDesc || hasAnyImage;

                setShowPoiModal(shouldOpen);
            } catch (e) {
                console.warn("[POI] fetchPoiInfo error", e);
                if (!alive || reqId !== lastReqRef.current) return;
                setSelectedPoiInfo(null);
                setShowPoiModal(false);
            } finally {
                if (alive && reqId === lastReqRef.current)
                    setLoadingPoi(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi]);

    /* ====== Guardar distrito ====== */
    const handleDistrictSave = async () => {
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
                population: distPopulation
                    ? Number(distPopulation.replace(/\D/g, ""))
                    : null,
                municipalitiesCount: distMunicipalities
                    ? Number(distMunicipalities)
                    : null,
                parishesCount: distParishes
                    ? Number(distParishes)
                    : null,
                files: distMedia.length > 0 ? distMedia : [],
            };

            const updated = await updateDistrict(districtInfo.id, payload);

            // sincronia local
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
            setDistrictError(
                e?.message || "Falha ao guardar alterações do distrito."
            );
        } finally {
            setSavingDistrict(false);
        }
    };

    const handleCancelEdit = () => {
        if (districtInfo) {
            setDistPopulation(
                districtInfo.population != null
                    ? String(districtInfo.population)
                    : ""
            );
            setDistMunicipalities(
                (districtInfo as any).municipalities != null
                    ? String((districtInfo as any).municipalities)
                    : ""
            );
            setDistParishes(
                (districtInfo as any).parishes != null
                    ? String((districtInfo as any).parishes)
                    : ""
            );
            setDistInhabitedSince(districtInfo.inhabited_since ?? "");
            setDistDescription(districtInfo.description ?? "");
            setDistHistory(districtInfo.history ?? "");
            setDistMedia(districtInfo.files ?? []);
        }
        setEditingDistrict(false);
        setDistrictError(null);
        setShowGallery(false);
    };

    const districtNameFallback =
        (districtFeature?.properties?.name as string | undefined) ||
        "Distrito";

    // detecta vídeos mesmo quando o URL é blob:...#name=ficheiro.mp4
    const isVideoUrl = (url: string) => {
        const namePart = url.split("#name=")[1] ?? url;
        return /\.(mp4|webm|ogg|mov|m4v)$/i.test(namePart);
    };

    const mediaUrls = useMemo(() => {
        const uniq: string[] = [];
        for (const u of distMedia ?? []) {
            if (!u) continue;
            if (!uniq.includes(u)) uniq.push(u);
        }

        const videos = uniq.filter(isVideoUrl);
        const images = uniq.filter((u) => !isVideoUrl(u));

        // vídeos primeiro
        return [...videos, ...images];
    }, [distMedia]);

    const rootClass =
        "district-modal theme-dark" +
        (showGallery ? " district-modal--gallery-open" : "");

    const toggleGallery = () => {
        // FECHAR
        if (showGallery) {
            setShowGallery(false);
            setEditingDistrict(false);
            setDistrictError(null);
            setLoadingGallery(false);
            return;
        }

        // ABRIR → preparar media + spinner
        setLoadingGallery(true);

        (async () => {
            try {
                let dbFiles: string[] = [];

                // 1) ir ao BE buscar ficheiros atuais do distrito
                if (districtInfo?.id) {
                    const dto = await fetchDistrictById(districtInfo.id);
                    dbFiles = dto.files ?? [];

                    setDistrictInfo(prev =>
                        prev
                            ? {
                                ...prev,
                                population: dto.population ?? prev.population,
                                municipalities:
                                    dto.municipalitiesCount ??
                                    (prev as any).municipalities,
                                parishes:
                                    dto.parishesCount ??
                                    (prev as any).parishes,
                                inhabited_since:
                                    dto.inhabitedSince ??
                                    prev.inhabited_since,
                                description:
                                    dto.description ?? prev.description,
                                history: dto.history ?? prev.history,
                                files: dbFiles,
                            }
                            : prev
                    );
                }

                // 2) Wikimedia → procurar por nome do distrito
                const nameForSearch =
                    distName ||
                    districtInfo?.namePt ||
                    districtInfo?.name ||
                    districtNameFallback;

                const wikiRaw = await searchWikimediaImagesByName(nameForSearch, 20);

                // primeiro filtramos as do Wikimedia
                const wikiValid =
                    wikiRaw.length > 0
                        ? await loadFirstValidImages(wikiRaw, 5)
                        : [];

                // 3) merge BD + Wikimedia (sem duplicados)
                const merged = Array.from(
                    new Set<string>([...dbFiles, ...wikiValid])
                );

                setDistMedia(merged);
                setShowGallery(true);

                // 4) Se houver novas (presentes no merged e não em dbFiles) → gravar na BD
                if (districtInfo?.id) {
                    const novos = merged.filter(u => !dbFiles.includes(u));
                    if (novos.length > 0) {
                        try {
                            const updated = await updateDistrict(districtInfo.id, {
                                // mantemos os ficheiros existentes + novos
                                files: merged,
                            });

                            setDistrictInfo(prev =>
                                prev
                                    ? {
                                        ...prev,
                                        files: updated.files ?? merged,
                                    }
                                    : prev
                            );
                        } catch (e) {
                            console.warn(
                                "[DistrictModal] Falha ao atualizar ficheiros do distrito",
                                e
                            );
                        }
                    }
                }
            } catch (e) {
                console.warn("[DistrictModal] Falha a preparar galeria", e);
                setDistMedia([]);
                setShowGallery(true);
            } finally {
                setLoadingGallery(false);
            }
        })();
    };
    if (!open) {
        return null;
    }

    return (
        <div className={rootClass}>
            <div className="poi-top">
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
                {/* LADO ESQUERDO:
                    - modo normal: mapa
                    - modo galeria: slideshow + uploader
                */}
                <div className="left-pane">
                    {!showGallery ? (
                        <MapContainer
                            center={[39.5, -8]}
                            zoom={8}
                            scrollWheelZoom
                            attributionControl
                            preferCanvas
                            style={{ height: "100%", width: "100%" }}
                        >
                            <Pane name="districtBase" style={{ zIndex: 200 }}>
                                <TileLayer url={DISTRICT_DETAIL} />
                            </Pane>

                            <Pane
                                name="districtLabels"
                                style={{ zIndex: 210, pointerEvents: "none" }}
                            >
                                <TileLayer url={DISTRICT_LABELS} />
                            </Pane>

                            {districtFeature && (
                                <GeoJSON
                                    data={districtFeature as any}
                                    style={() => ({
                                        color: "#2E7D32",
                                        weight: 2,
                                        fillOpacity: 0,
                                    })}
                                    interactive={false}
                                />
                            )}

                            {rivers && (
                                <Pane name="rivers" style={{ zIndex: Z_RIVERS }}>
                                    <GeoJSON
                                        data={rivers as any}
                                        style={{ color: COLOR_RIVER, weight: 1.5 }}
                                        interactive={false}
                                    />
                                </Pane>
                            )}
                            {lakes && (
                                <Pane name="lakes" style={{ zIndex: Z_LAKES }}>
                                    <GeoJSON
                                        data={lakes as any}
                                        style={{
                                            color: COLOR_LAKE,
                                            weight: 1,
                                            fillColor: COLOR_LAKE,
                                            fillOpacity: 0.3,
                                            opacity: 0.9,
                                        }}
                                        interactive={false}
                                    />
                                </Pane>
                            )}
                            {rails && (
                                <Pane name="rails" style={{ zIndex: Z_RAIL }}>
                                    <GeoJSON
                                        data={rails as any}
                                        style={{
                                            color: COLOR_RAIL,
                                            weight: 1,
                                            dashArray: "4,3",
                                            opacity: 0.9,
                                        }}
                                        interactive={false}
                                    />
                                </Pane>
                            )}
                            {roads && (
                                <Pane name="roads" style={{ zIndex: Z_ROADS }}>
                                    <GeoJSON
                                        data={roads as any}
                                        style={{
                                            color: COLOR_ROAD,
                                            weight: 1.2,
                                            opacity: 0.9,
                                        }}
                                        interactive={false}
                                    />
                                </Pane>
                            )}
                            {peaks && (
                                <Pane name="peaks" style={{ zIndex: Z_PEAKS }}>
                                    <GeoJSON
                                        data={peaks as any}
                                        pointToLayer={(_f, latlng) =>
                                            L.circleMarker(latlng, {
                                                radius: 3.5,
                                                color: COLOR_PEAK,
                                                weight: 1,
                                                fillColor: COLOR_PEAK,
                                                fillOpacity: 0.9,
                                            })
                                        }
                                    />
                                </Pane>
                            )}
                            {places && (
                                <Pane
                                    name="places"
                                    style={{ zIndex: Z_PLACES, pointerEvents: "none" }}
                                >
                                    <GeoJSON
                                        data={places as any}
                                        pointToLayer={(f, latlng) => {
                                            const name =
                                                f?.properties?.NAME ??
                                                f?.properties?.name ??
                                                f?.properties?.["name:pt"] ??
                                                null;
                                            if (!name) {
                                                return L.circleMarker(latlng, {
                                                    radius: 2,
                                                    color: "#444",
                                                    weight: 1,
                                                    fillColor: "#444",
                                                    fillOpacity: 0.7,
                                                });
                                            }
                                            return L.marker(latlng, {
                                                icon: L.divIcon({
                                                    className: "place-label",
                                                    html: `<span>${name}</span>`,
                                                }),
                                                interactive: false,
                                            });
                                        }}
                                    />
                                </Pane>
                            )}

                            {poiAreas && (
                                <Pane name="areas" style={{ zIndex: 430 }}>
                                    <PoiAreasLayer data={poiAreas} />
                                </Pane>
                            )}

                            {filteredPoints && (
                                <Pane name="points" style={{ zIndex: 460 }}>
                                    <PoiPointsLayer
                                        data={filteredPoints}
                                        selectedTypes={selectedTypes}
                                        nonce={renderNonce}
                                        onSelect={onPoiClick}
                                    />
                                </Pane>
                            )}

                            <FitDistrictBounds feature={districtFeature} />
                        </MapContainer>
                    ) : (
                        <section className="district-gallery-left gold-scroll">
                            <div className="district-gallery-main">
                                <MediaSlideshow
                                    items={mediaUrls}
                                    title={distName || districtNameFallback}
                                />
                            </div>

                            {editingDistrict && districtInfo?.id && (
                                <div className="district-gallery-editor">
                                    <ImageDropField
                                        label="Imagens / vídeos do distrito"
                                        images={distMedia}
                                        onChange={setDistMedia}
                                        // se o teu ImageDropField só aceita "image" | "video",
                                        // deixa "image" aqui, porque estamos a gravar apenas URLs.
                                        mode="image"
                                    />
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* LADO DIREITO – conteúdo textual */}
                <aside className="right-panel gold-scroll">
                    <div className="right-inner">
                        {/* Header com edição (Editar aparece só em modo galeria) */}
                        <div className="district-header">
                            <div className="district-header-main">
                                {editingDistrict ? (
                                    <input
                                        className="district-name-input"
                                        value={distName}
                                        onChange={(e) =>
                                            setDistName(e.target.value)
                                        }
                                    />
                                ) : (
                                    <h1 className="district-title">
                                        <strong>
                                            {distName || districtNameFallback}
                                        </strong>
                                    </h1>
                                )}
                            </div>
                            <div className="district-header-actions">
                                {showGallery &&
                                    (editingDistrict ? (
                                        <>
                                            <button
                                                type="button"
                                                className="district-btn district-btn--ghost"
                                                onClick={handleCancelEdit}
                                                disabled={savingDistrict}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                className="district-btn district-btn--primary"
                                                onClick={handleDistrictSave}
                                                disabled={savingDistrict}
                                            >
                                                {savingDistrict
                                                    ? "A guardar..."
                                                    : "Guardar"}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="district-btn district-btn--ghost"
                                            onClick={() =>
                                                setEditingDistrict(true)
                                            }
                                        >
                                            Editar
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {/* Botão de abrir/fechar galeria */}
                        <div className="district-header-subrow">
                            <button
                                type="button"
                                className="district-videos-toggle"
                                onClick={toggleGallery}
                            >
                                {showGallery ? "Fechar galeria" : "Galeria"}
                            </button>
                        </div>

                        {districtError && (
                            <div className="district-error">
                                {districtError}
                            </div>
                        )}

                        {/* Resumo / texto */}
                        <div className="district-info">
                            <div className="district-meta">
                                <div>
                                    <strong>População:</strong>{" "}
                                    {editingDistrict ? (
                                        <input
                                            className="district-meta-input"
                                            value={distPopulation}
                                            onChange={(e) =>
                                                setDistPopulation(e.target.value)
                                            }
                                        />
                                    ) : (
                                        distPopulation || "—"
                                    )}
                                </div>
                                <div>
                                    <strong>Concelhos:</strong>{" "}
                                    {editingDistrict ? (
                                        <input
                                            className="district-meta-input"
                                            value={distMunicipalities}
                                            onChange={(e) =>
                                                setDistMunicipalities(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    ) : (
                                        distMunicipalities || "—"
                                    )}
                                </div>
                                <div>
                                    <strong>Freguesias:</strong>{" "}
                                    {editingDistrict ? (
                                        <input
                                            className="district-meta-input"
                                            value={distParishes}
                                            onChange={(e) =>
                                                setDistParishes(e.target.value)
                                            }
                                        />
                                    ) : (
                                        distParishes || "—"
                                    )}
                                </div>
                                <div>
                                    <strong>Habitado desde:</strong>{" "}
                                    {editingDistrict ? (
                                        <input
                                            className="district-meta-input"
                                            value={distInhabitedSince}
                                            onChange={(e) =>
                                                setDistInhabitedSince(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    ) : (
                                        distInhabitedSince || "—"
                                    )}
                                </div>
                            </div>

                            {/* descrição / história */}
                            <div className="district-text-blocks">
                                {editingDistrict ? (
                                    <>
                                        <label className="district-label">
                                            Descrição
                                        </label>
                                        <textarea
                                            className="district-textarea"
                                            rows={4}
                                            value={distDescription}
                                            onChange={(e) =>
                                                setDistDescription(
                                                    e.target.value
                                                )
                                            }
                                        />

                                        <label className="district-label">
                                            História
                                        </label>
                                        <textarea
                                            className="district-textarea"
                                            rows={6}
                                            value={distHistory}
                                            onChange={(e) =>
                                                setDistHistory(
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </>
                                ) : (
                                    <>
                                        {distDescription && (
                                            <p className="district-description">
                                                {distDescription}
                                            </p>
                                        )}

                                        {distHistory && (
                                            <p className="district-history">
                                                {distHistory}
                                            </p>
                                        )}

                                        {!distDescription && !distHistory && (
                                            <p className="district-description">
                                                Sem informação detalhada para
                                                este distrito (ainda).
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Modal do POI */}
            <PoiModal
                open={showPoiModal}
                onClose={() => {
                    setShowPoiModal(false);
                    setSelectedPoi(null);
                    setSelectedPoiInfo(null);
                }}
                info={selectedPoiInfo}
                poi={selectedPoi}
                onSaved={(patch) => {
                    onPoiUpdated?.(patch);
                }}
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