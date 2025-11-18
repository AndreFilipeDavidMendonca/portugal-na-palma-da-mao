// src/pages/district/DistrictModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
    MapContainer,
    TileLayer,
    GeoJSON,
    Pane,
    useMap,
    WMSTileLayer,
} from "react-leaflet";

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
    SIPA_WMS_URL,
    SIPA_WMS_LAYER,
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
import SpinnerOverlay from "@/components/SpinnerOverlay";

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

    /* ====== Estado do POI selecionado ====== */
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

    /* ----- lazy load camadas geográficas ----- */
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

    /* ----- Normalização + filtro (POIs OSM) ----- */
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;

        const feats = (poiPoints.features ?? [])
            .map((f: any) => {
                const props = { ...(f.properties || {}) };
                const tags = props.tags ?? f.tags ?? {};
                const mergedProps = { ...props, ...tags, tags };

                const name =
                    mergedProps["name:pt"] ||
                    mergedProps.name ||
                    mergedProps["name:en"] ||
                    mergedProps["label"] ||
                    null;

                if (!name || typeof name !== "string" || name.trim() === "") return null;

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

                if (!hasRefs && !hasType) return null;

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

    /* ----- Aplicar filtros por seleção ----- */
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

    /* ====== Fetch info LIMPA (centralizado no poiInfo) ====== */
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

                const approxName =
                    selectedPoi.properties["name:pt"] ??
                    selectedPoi.properties.name ??
                    null;
                const approxLat = selectedPoi.geometry?.coordinates?.[1];
                const approxLon = selectedPoi.geometry?.coordinates?.[0];

                const info = await fetchPoiInfo({
                    wikipedia: wp,
                    approx: { name: approxName, lat: approxLat, lon: approxLon },
                    sourceFeature: selectedPoi,
                });
                if (!alive || reqId !== lastReqRef.current) return;

                setSelectedPoiInfo(info);

                const hasAnyImage = info?.image || (info?.images?.length ?? 0) > 0;
                const hasTitle = !!info?.label;
                const hasDesc = !!info?.description && info.description.trim().length > 0;
                const shouldOpen = !!(hasTitle || hasDesc || hasAnyImage);

                setShowPoiModal(shouldOpen);
            } catch (e) {
                console.warn("[POI] fetchPoiInfo error", e);
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
                        {/* Base Carto */}
                        <Pane name="districtBase" style={{ zIndex: 200 }}>
                            <TileLayer url={DISTRICT_DETAIL} />
                        </Pane>

                        {/* Labels base */}
                        <Pane name="districtLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                            <TileLayer url={DISTRICT_LABELS} />
                        </Pane>

                        {/* 🟣 Património oficial (SIPA WMS) */}
                        <Pane name="sipaMonuments" style={{ zIndex: 300 }}>
                            <WMSTileLayer
                                url={SIPA_WMS_URL}
                                layers={SIPA_WMS_LAYER}
                                format="image/png"
                                transparent={true}
                                version="1.3.0"
                            />
                        </Pane>

                        {/* Polígono do distrito selecionado */}
                        {districtFeature && (
                            <GeoJSON
                                data={districtFeature as any}
                                style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                                interactive={false}
                            />
                        )}

                        {/* Rios */}
                        {rivers && (
                            <Pane name="rivers" style={{ zIndex: Z_RIVERS }}>
                                <GeoJSON
                                    data={rivers as any}
                                    style={{ color: COLOR_RIVER, weight: 1.5 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Lagos */}
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

                        {/* Linhas férreas */}
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

                        {/* Estradas */}
                        {roads && (
                            <Pane name="roads" style={{ zIndex: Z_ROADS }}>
                                <GeoJSON
                                    data={roads as any}
                                    style={{ color: COLOR_ROAD, weight: 1.2, opacity: 0.9 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Picos */}
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

                        {/* Cidades / labels de lugares */}
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

                        {/* Áreas OSM (parques, etc.) */}
                        {poiAreas && (
                            <Pane name="areas" style={{ zIndex: 430 }}>
                                <PoiAreasLayer data={poiAreas} />
                            </Pane>
                        )}

                        {/* Pontos OSM normalizados + filtrados */}
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

                        {/* Ajuste de bounds ao distrito */}
                        <FitDistrictBounds feature={districtFeature} />
                    </MapContainer>
                </div>

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
                                        {districtInfo.population?.toLocaleString("pt-PT") ??
                                            "—"}
                                    </div>
                                    <div>
                                        <strong>Concelhos:</strong>{" "}
                                        {districtInfo.municipalities ?? "—"}
                                    </div>
                                    <div>
                                        <strong>Freguesias:</strong>{" "}
                                        {districtInfo.parishes ?? "—"}
                                    </div>
                                    <div>
                                        <strong>Habitado desde:</strong>{" "}
                                        {districtInfo.inhabited_since ?? "—"}
                                    </div>
                                </div>

                                {districtInfo.description && (
                                    <p className="district-description">
                                        {districtInfo.description}
                                    </p>
                                )}

                                {districtInfo.history && (
                                    <p className="district-history">
                                        {districtInfo.history}
                                    </p>
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

            {/* Overlay loading */}
            {loadingPoi && (
                <SpinnerOverlay open={loadingPoi} message="A carregar…" />
            )}
        </div>
    );
}