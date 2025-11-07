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
import {
    PoiAreasLayer,
    getPoiCategory,
    PoiPointsLayer,
} from "@/features/map/PoiLayers";
import PoiFilter from "@/features/filters/PoiFilter";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import PoiModal from "@/pages/poi/PoiModal";

import "./DistrictModal.scss";

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

/* ---------- Helpers: normalizar & validar imagens ---------- */
function normalizeCommonsUrl(u: string): string {
    if (!u) return u;
    try {
        const url = new URL(u);
        if (!/commons\.wikimedia\.org$/i.test(url.hostname)) return u;
        const p = url.pathname;

        const extractFileName = (s: string) => {
            const decoded = decodeURIComponent(s);
            const afterColon = decoded.split(":").pop() || decoded;
            return afterColon.trim();
        };

        if (/\/wiki\/Special:Redirect\/file\//i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/Special:Redirect\/file\//i, "");
            const fileName = extractFileName(filePart);
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
                fileName
            )}`;
        }

        if (/\/wiki\/(File|Ficheiro):/i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/(File|Ficheiro):/i, "");
            const fileName = extractFileName(filePart);
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
                fileName
            )}`;
        }

        return u;
    } catch {
        return u;
    }
}

function buildNormalizedGallery(info: {
    image?: string | null;
    images?: string[] | null;
}): string[] {
    const arr: string[] = [];
    const push = (s?: string | null) => {
        if (!s) return;
        const n = normalizeCommonsUrl(s);
        if (n && !arr.includes(n)) arr.push(n);
    };
    push(info.image ?? null);
    for (const u of info.images ?? []) push(u);
    return arr;
}

function getFeatureName(f: any): string | null {
    const p = f?.properties ?? {};
    const tags = p.tags ?? {};
    return (
        p["name:pt"] ||
        p.name ||
        p["name:en"] ||
        tags["name:pt"] ||
        tags.name ||
        tags["name:en"] ||
        null
    );
}

function testLoadable(url: string, timeoutMs = 8000): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image();
        const t = setTimeout(() => resolve(false), timeoutMs);
        img.onload = () => {
            clearTimeout(t);
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(t);
            resolve(false);
        };
        img.src = url;
    });
}

async function filterLoadableImages(
    urls: string[],
    timeoutMs = 8000
): Promise<string[]> {
    const results = await Promise.all(urls.map((u) => testLoadable(u, timeoutMs)));
    return urls.filter((_, i) => results[i]);
}

/* ---------- Props ---------- */
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
    } = props;

    /* ====== Estado do POI selecionado (MOVER PARA O TOPO) ====== */
    const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
    const [selectedPoiInfo, setSelectedPoiInfo] = useState<PoiInfo | null>(null);
    const [showPoiModal, setShowPoiModal] = useState(false);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const lastReqRef = useRef(0);

    /* ----- remount nonce para limpar layers ----- */
    const [renderNonce, setRenderNonce] = useState(0);

    /* ----- camadas base (lazy) ----- */
    const [rivers, setRivers] = useState<any>(riversProp);
    const [lakes, setLakes] = useState<any>(lakesProp);
    const [rails, setRails] = useState<any>(railsProp);
    const [roads, setRoads] = useState<any>(roadsProp);
    const [peaks, setPeaks] = useState<any>(peaksProp);
    const [places, setPlaces] = useState<any>(placesProp);

    /* ----- info do distrito ----- */
    const [districtInfo, setDistrictInfo] = useState<any>(null);

    const isPoiCategory = (val: any): val is PoiCategory =>
        val != null && Object.prototype.hasOwnProperty.call(POI_LABELS, val);

    useEffect(() => {
        if (!districtFeature?.properties?.name) {
            setDistrictInfo(null);
            return;
        }
        const name = districtFeature.properties.name;
        import("@/lib/districtInfo")
            .then(({ fetchDistrictInfo }) => fetchDistrictInfo(name))
            .then(setDistrictInfo)
            .catch(() => setDistrictInfo(null));
    }, [districtFeature]);

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
        safeLoad("/geo/rios_pt.geojson", setRivers, riversProp);
        safeLoad("/geo/lagos_pt.geojson", setLakes, lakesProp);
        safeLoad("/geo/ferrovias_pt.geojson", setRails, railsProp);
        safeLoad("/geo/estradas_pt.geojson", setRoads, roadsProp);
        safeLoad("/geo/picos_pt.geojson", setPeaks, peaksProp);
        safeLoad("/geo/cidades_pt.geojson", setPlaces, placesProp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ----- Normalização + filtro (remove sem nome e "só nome") ----- */
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };
                const tags = props.tags ?? f.tags ?? {};
                const mergedProps = { ...props, ...tags, tags };

                // nome do POI
                const name =
                    mergedProps["name:pt"] ||
                    mergedProps.name ||
                    mergedProps["name:en"] ||
                    mergedProps["label"] ||
                    null;

                // 1) sem nome -> descarta
                if (!name || typeof name !== "string" || name.trim() === "") return null;

                // 2) só nome sem refs/tipo -> descarta (TODO: remover quando enriquecermos automaticamente)
                const hasRefs =
                    mergedProps.wikipedia ||
                    mergedProps["wikipedia:pt"] ||
                    mergedProps["wikipedia:en"] ||
                    mergedProps.wikidata ||
                    mergedProps["wikidata:id"] ||
                    mergedProps.website ||
                    mergedProps["contact:website"] ||
                    mergedProps.image ||
                    mergedProps["wikimedia_commons"] ||
                    tags.wikipedia ||
                    tags.wikidata ||
                    tags.website ||
                    tags.image;

                const hasType =
                    mergedProps.historic ||
                    mergedProps.building ||
                    mergedProps.castle_type ||
                    mergedProps.amenity ||
                    mergedProps.tourism ||
                    mergedProps.leisure ||
                    mergedProps.boundary;

                if (!hasRefs && !hasType) return null; // ← filtro “só nome”

                const nf = { ...f, properties: mergedProps as any };
                const cat = getPoiCategory(nf);
                if (isPoiCategory(cat)) (nf.properties as any).__cat = cat;

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
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            if (cat) counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalizedPoints]);

    /* ----- Aplicar filtros ----- */
    const filteredPoints = useMemo(() => {
        if (!normalizedPoints) return null;
        if (!selectedTypes || selectedTypes.size === 0) return normalizedPoints;
        const feats = normalizedPoints.features.filter((f: any) => {
            const cat = (f.properties as any).__cat as PoiCategory | undefined;
            return cat ? selectedTypes.has(cat) : false;
        });
        return { ...normalizedPoints, features: feats };
    }, [normalizedPoints, selectedTypes]);

    /* ====== Clique num ponto ====== */
    const onPoiClick = (feature: any) => {
        setSelectedPoi(feature);
    };

    /* ====== Fetch info + pré-carregamento de imagens ====== */
    useEffect(() => {
        let alive = true;
        (async () => {
            if (!selectedPoi?.properties) return;

            setShowPoiModal(false);
            setSelectedPoiInfo(null);
            setLoadingPoi(true);
            const reqId = ++lastReqRef.current;

            try {
                const wp: string | null =
                    selectedPoi.properties.wikipedia ??
                    selectedPoi.properties["wikipedia:pt"] ??
                    selectedPoi.properties["wikipedia:en"] ??
                    null;
                const wd: string | null = selectedPoi.properties.wikidata ?? null;

                let info = await fetchPoiInfo({ wikidata: wd, wikipedia: wp });
                if (!alive || reqId !== lastReqRef.current) return;

                const normalized = buildNormalizedGallery(info ?? {});
                const loadable = await filterLoadableImages(normalized, 8000);
                if (!alive || reqId !== lastReqRef.current) return;

                let image: string | null = null;
                let images: string[] = [];
                if (loadable.length > 0) {
                    image = loadable[0];
                    images = loadable.slice(1);
                }

                const finalInfo: PoiInfo = { ...(info ?? {}), image, images };

                // fallback para título do próprio feature (se faltar label)
                if (!finalInfo.label) {
                    const fallbackName = getFeatureName(selectedPoi);
                    if (fallbackName) finalInfo.label = fallbackName;
                }

                setSelectedPoiInfo(finalInfo);

                // Abrir se existir: título OU descrição OU alguma imagem
                const hasAnyImage = loadable.length > 0;
                const hasTitle = !!finalInfo.label;
                const hasDesc =
                    !!finalInfo.description && finalInfo.description.trim().length > 0;

                const shouldOpen = hasTitle || hasDesc || hasAnyImage;
                setShowPoiModal(shouldOpen);
            } catch {
                if (!alive || reqId !== lastReqRef.current) return;
                setSelectedPoiInfo(null);
                setShowPoiModal(false);
            } finally {
                if (alive && reqId === lastReqRef.current) setLoadingPoi(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [selectedPoi]);

    if (!open) return null;

    return (
        <div className="district-modal theme-dark">
            {/* barra de filtros no topo do modal */}
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
                <div className="left-map">
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

                        <Pane name="districtLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                            <TileLayer url={DISTRICT_LABELS} />
                        </Pane>

                        {/* contorno do distrito */}
                        {districtFeature && (
                            <GeoJSON
                                data={districtFeature as any}
                                style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                                interactive={false}
                            />
                        )}

                        {/* exemplo de camada extra (rios) — podes reativar as restantes */}
                        {rivers && (
                            <Pane name="rivers" style={{ zIndex: Z_RIVERS }}>
                                <GeoJSON
                                    data={rivers as any}
                                    style={{ color: COLOR_RIVER, weight: 1.5 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* áreas/polígonos de POI */}
                        {poiAreas && (
                            <Pane name="areas" style={{ zIndex: 430 }}>
                                <PoiAreasLayer data={poiAreas} />
                            </Pane>
                        )}

                        {/* pontos de POI (clicáveis / já normalizados & filtrados) */}
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
                </div>

                {/* painel direito com dados do distrito */}
                <aside className="right-panel">
                    <div className="right-inner">
                        <h1>
                            <strong>{districtFeature?.properties?.name || "Distrito"}</strong>
                        </h1>

                        {districtInfo && (
                            <div className="district-info">
                                <div className="district-meta">
                                    <div>
                                        <strong>População:</strong>{" "}
                                        {districtInfo.population?.toLocaleString("pt-PT") ?? "—"}
                                    </div>
                                    <div>
                                        <strong>Concelhos:</strong> {districtInfo.municipalities ?? "—"}
                                    </div>
                                    <div>
                                        <strong>Freguesias:</strong> {districtInfo.parishes ?? "—"}
                                    </div>
                                    <div>
                                        <strong>Habitado desde:</strong>{" "}
                                        {districtInfo.inhabited_since ?? "—"}
                                    </div>
                                </div>

                                {districtInfo.description && (
                                    <p className="district-description">{districtInfo.description}</p>
                                )}

                                {districtInfo.history && (
                                    <p className="district-history">{districtInfo.history}</p>
                                )}
                            </div>
                        )}
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
            />

            {/* Overlay de loading com blur verde-escuro */}
            {loadingPoi && (
                <div className="poi-preloader" role="status" aria-live="polite" aria-busy="true">
                    <div className="spinner" />
                    <span className="sr-only">A carregar…</span>
                </div>
            )}
        </div>
    );
}