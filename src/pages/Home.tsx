// src/pages/Home.tsx
import { MapContainer, TileLayer, Pane } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";

import { WORLD_BASE, WORLD_LABELS, type PoiCategory } from "@/utils/constants";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";
import {
    fetchDistricts,
    fetchPois,
    type DistrictDto,
    type PoiDto,
} from "@/lib/api";
import { filterPointsInsideDistrict } from "@/lib/spatial";

type AnyGeo = any;

// Converte array de PoiDto em FeatureCollection de pontos
function poiDtosToGeoJSON(pois: PoiDto[]): AnyGeo {
    return {
        type: "FeatureCollection",
        features: pois.map((p) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                // ⚠️ Ordem [lon, lat]
                coordinates: [p.lon, p.lat],
            },
            properties: {
                // id do próprio POI (backend)
                id: p.id,
                poiId: p.id, // 👈 extra, se quiseres usar explicitamente poi_id

                districtId: p.districtId,
                name: p.name,
                namePt: p.namePt ?? p.name,
                category: p.category,
                subcategory: p.subcategory,
                description: p.description,
                wikipediaUrl: p.wikipediaUrl,
                sipaId: p.sipaId,
                externalOsmId: p.externalOsmId,
                source: p.source,

                image: p.image,
                images: p.images ?? [],

                // para o DistrictModal considerar como “útil”
                historic: p.category || "poi",
                tags: {
                    category: p.category,
                    subcategory: p.subcategory,
                },
            },
        })),
    };
}

export default function Home() {
    // ----- Geo base -----
    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    // Mundo visível sem repetição
    const WORLD_BOUNDS = L.latLngBounds(
        [-85.05112878, -180],
        [85.05112878, 180]
    );

    // ----- Distritos (API) -----
    const [districtDtos, setDistrictDtos] = useState<DistrictDto[]>([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    // ----- Filtros POI -----
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(
        new Set()
    );

    // ----- Modal de Distrito -----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(
        null
    );

    // POIs do distrito ativo (já em GeoJSON, recortados ao polígono)
    const [activeDistrictPois, setActiveDistrictPois] = useState<AnyGeo | null>(
        null
    );
    const [loadingDistrictPois, setLoadingDistrictPois] = useState(false);
    const poisReqRef = useRef(0);

    // Map ref
    const mapRef = useRef<L.Map | null>(null);

    // =========================
    //   Carregamento de dados base
    // =========================
    useEffect(() => {
        let aborted = false;

        Promise.all([
            loadGeo("/geo/portugal.geojson"),
            loadGeo("/geo/distritos.geojson").catch(() => null),
        ])
            .then(([ptData, distData]) => {
                if (aborted) return;
                setPtGeo(ptData);
                setDistrictsGeo(distData);
            })
            .catch((e) => console.error("[geo] Falha ao carregar PT/distritos:", e));

        return () => {
            aborted = true;
        };
    }, []);

    // =========================
    //   Carregar distritos via API
    // =========================
    useEffect(() => {
        let alive = true;
        setLoadingDistricts(true);
        fetchDistricts()
            .then((ds) => {
                if (!alive) return;
                setDistrictDtos(ds);
            })
            .catch((e) => {
                console.error("[api] Falha a carregar distritos:", e);
            })
            .finally(() => {
                if (alive) setLoadingDistricts(false);
            });

        return () => {
            alive = false;
        };
    }, []);

    // nome → DTO de distrito
    const districtDtoByName = useMemo(() => {
        const m = new Map<string, DistrictDto>();
        for (const d of districtDtos) {
            if (d.namePt) m.set(d.namePt, d);
            if (d.name) m.set(d.name, d);
        }
        return m;
    }, [districtDtos]);

    // nome → feature (shapes do mapa)
    const featureByName = useMemo(() => {
        const m = new Map<string, any>();
        if (districtsGeo?.features) {
            for (const f of districtsGeo.features) {
                const name =
                    f?.properties?.name ||
                    f?.properties?.NAME ||
                    f?.properties?.["name:pt"];
                if (name) m.set(name, f);
            }
        }
        return m;
    }, [districtsGeo]);

    const districtNames = useMemo(
        () =>
            Array.from(featureByName.keys()).sort((a, b) =>
                a.localeCompare(b, "pt-PT", { sensitivity: "base" })
            ),
        [featureByName]
    );

    // =========================
    //       Handlers UI
    // =========================
    function togglePoiType(k: PoiCategory) {
        setSelectedPoiTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }

    function clearPoiTypes() {
        setSelectedPoiTypes(new Set());
    }

    // carrega POIs da API para um dado feature de distrito
    async function loadPoisForDistrictFeature(feature: any) {
        if (!feature?.properties) {
            setActiveDistrictPois(null);
            return;
        }

        const name =
            feature.properties.name ||
            feature.properties.NAME ||
            feature.properties["name:pt"];

        if (!name) {
            setActiveDistrictPois(null);
            return;
        }

        const dto = districtDtoByName.get(name);
        if (!dto) {
            console.warn("[Home] Não encontrei DistrictDto para nome:", name);
            setActiveDistrictPois(null);
            return;
        }

        const reqId = ++poisReqRef.current;
        setLoadingDistrictPois(true);
        setActiveDistrictPois(null);

        try {
            // 👉 Agora buscamos TODOS os POIs
            const pois = await fetchPois();
            if (reqId !== poisReqRef.current) return; // pedido ultrapassado

            const allGeo = poiDtosToGeoJSON(pois);

            // 👉 recorta pelo polígono do distrito para não mostrar pontos fora
            const clipped =
                filterPointsInsideDistrict(allGeo, feature) ??
                { type: "FeatureCollection", features: [] };

            setActiveDistrictPois(clipped);
        } catch (e) {
            console.error("[api] Falha a carregar POIs do distrito:", e);
            if (reqId === poisReqRef.current) {
                setActiveDistrictPois(null);
            }
        } finally {
            if (reqId === poisReqRef.current) setLoadingDistrictPois(false);
        }
    }

    async function openDistrictModal(feature: any) {
        setActiveDistrictFeature(feature);
        setIsModalOpen(true);
        await loadPoisForDistrictFeature(feature);
    }

    // Pick vindo do topo: centra e abre modal
    function handlePickFromTop(name: string) {
        const f = featureByName.get(name);
        if (!f) return;
        zoomToFeatureBounds(f);
        openDistrictModal(f);
    }

    // Fechar modal: recenter
    function handleCloseModal() {
        setIsModalOpen(false);
        setActiveDistrictFeature(null);
        setActiveDistrictPois(null);
        if (mapRef.current && ptGeo) fitGeoJSONBoundsTight(mapRef.current, ptGeo);
    }

    // =========================
    //         Map utils
    // =========================
    function onMapReadyNoArg() {
        const map = mapRef.current;
        if (!map) return;
        if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, false);
    }

    function fitGeoJSONBoundsTight(map: L.Map, geo: any, animate = true) {
        if (!map || !geo) return;
        try {
            const gj = L.geoJSON(geo);
            const bounds = gj.getBounds();
            if (!bounds.isValid()) return;

            const currentZoom = map.getZoom();
            if (currentZoom > 6) map.setZoom(4);

            const topbar =
                document.querySelector<HTMLElement>(".top-district-filter");
            const topH = topbar?.offsetHeight ?? 0;

            const SIDE_PAD = 10;
            const TOP_PAD = topH + 50;
            const BOT_PAD = 10;

            map.fitBounds(bounds, {
                animate,
                paddingTopLeft: [SIDE_PAD, TOP_PAD],
                paddingBottomRight: [SIDE_PAD, BOT_PAD],
                maxZoom: 3,
            });

            map.setMaxBounds(bounds.pad(0.22));
            setTimeout(() => map.invalidateSize(), 0);
        } catch (err) {
            console.error("[fitGeoJSONBoundsTight] erro:", err);
        }
    }

    function zoomToFeatureBounds(feature: any) {
        const map = mapRef.current;
        if (!map) return;
        const gj = L.geoJSON(feature);
        const b = gj.getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08), { animate: true });
    }

    // =========================
    //    Loading / Overlay
    // =========================
    const dataReady = Boolean(ptGeo && districtsGeo && !loadingDistricts);
    const showOverlay = !dataReady;

    // =========================
    //          Render
    // =========================
    return (
        <>
            {showOverlay && (
                <LoadingOverlay message="A carregar o mapa de Portugal…" />
            )}

            {!isModalOpen && (
                <div className="top-district-filter">
                    <div className="tdf-inner">
                        <TopDistrictFilter
                            allNames={districtNames}
                            onPick={handlePickFromTop}
                        />
                    </div>
                </div>
            )}

            <div className="map-shell">
                <MapContainer
                    ref={mapRef as any}
                    center={[30, 0]}
                    zoom={3}
                    whenReady={onMapReadyNoArg}
                    scrollWheelZoom
                    dragging
                    doubleClickZoom
                    attributionControl
                    preferCanvas
                    maxBounds={WORLD_BOUNDS}
                    maxBoundsViscosity={1.0}
                    minZoom={2}
                    style={{ height: "100vh", width: "100vw" }}
                >
                    <Pane
                        name="worldBase"
                        style={{ zIndex: 200, pointerEvents: "none" }}
                    >
                        <TileLayer
                            url={WORLD_BASE}
                            attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            noWrap
                        />
                    </Pane>

                    <Pane
                        name="worldLabels"
                        style={{ zIndex: 210, pointerEvents: "none" }}
                    >
                        <TileLayer
                            url={WORLD_LABELS}
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            noWrap
                        />
                    </Pane>

                    {districtsGeo && (
                        <DistrictsHoverLayer
                            data={districtsGeo as any}
                            onClickDistrict={(_name, feature) =>
                                feature && openDistrictModal(feature)
                            }
                        />
                    )}
                </MapContainer>
            </div>

            <DistrictModal
                open={isModalOpen}
                onClose={handleCloseModal}
                districtFeature={activeDistrictFeature}
                selectedTypes={selectedPoiTypes}
                onToggleType={togglePoiType}
                onClearTypes={clearPoiTypes}
                poiPoints={activeDistrictPois}
                population={null}
            />

            {/* loading específico dos POIs do distrito */}
            {loadingDistrictPois && (
                <LoadingOverlay message="A carregar pontos de interesse do distrito…" />
            )}
        </>
    );
}