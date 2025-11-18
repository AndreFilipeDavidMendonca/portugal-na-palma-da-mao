// src/pages/Home.tsx
import { MapContainer, TileLayer, Pane } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import {
    fetchPoiCategoryGeoJSON,
    mergeFeatureCollections,
} from "@/lib/overpass";
import { WORLD_BASE, WORLD_LABELS, type PoiCategory } from "@/utils/constants";
import { getDistrictKeyFromFeature } from "@/utils/geo";
import { filterPointsInsideDistrict } from "@/lib/spatial";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";
import SpinnerOverlay from "@/components/SpinnerOverlay";

type AnyGeo = any;

export default function Home() {
    // ----- Estado base -----
    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    // Mundo visível sem repetição
    const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);

    // ----- Filtros POI -----
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(new Set());

    // ----- POIs (Overpass, scope: PT) -----
    const [poiAllPT, setPoiAllPT] = useState<AnyGeo | null>(null);
    const [poisLoading, setPoisLoading] = useState(false);

    // ----- Modal de Distrito -----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrict, setActiveDistrict] = useState<any | null>(null);

    // POIs do distrito ativo (state em vez de useMemo pesado)
    const [poiForActive, setPoiForActive] = useState<AnyGeo | null>(null);

    // Loading específico do distrito selecionado
    const [districtLoading, setDistrictLoading] = useState(false);

    // Cache de POIs por distrito (em memória)
    const poiCacheRef = useRef(new Map<string, AnyGeo>());

    // Map ref
    const mapRef = useRef<L.Map | null>(null);

    // =========================
    //   Carregamento de dados base (Portugal + distritos)
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
    //   Carregar todos os POIs PT (por categoria, com cache por categoria)
    // =========================
    useEffect(() => {
        if (!ptGeo) return;

        const poly = geoToOverpassPoly(ptGeo);
        if (!poly) {
            console.warn("[overpass] poly não gerada");
            return;
        }

        const controller = new AbortController();
        setPoisLoading(true);

        const categories: PoiCategory[] = [
            "palace",
            "castle",
            "ruins",
            "monument",
            "church",
            "viewpoint",
            "park",
        ];

        Promise.all(
            categories.map((cat) =>
                fetchPoiCategoryGeoJSON(cat, poly, controller.signal)
            )
        )
            .then((collections) => {
                if (controller.signal.aborted) return;
                const merged = mergeFeatureCollections(...collections);
                setPoiAllPT(merged);
            })
            .catch((e) => {
                if (e?.name !== "AbortError") {
                    console.error("[overpass] falhou:", e);
                }
                setPoiAllPT(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) setPoisLoading(false);
            });

        return () => controller.abort();
    }, [ptGeo]);

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

    function openDistrictModal(feature: any) {
        setActiveDistrict(feature);
        setIsModalOpen(true);
        setDistrictLoading(true);
        setPoiForActive(null); // limpa POIs antigos do distrito anterior
    }

    // nome → feature (para a barra do topo)
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
        setActiveDistrict(null);
        setPoiForActive(null);
        setDistrictLoading(false);
        if (mapRef.current && ptGeo) fitGeoJSONBoundsTight(mapRef.current, ptGeo);
    }

    // =========================
    //   POIs do distrito ativo (cálculo pesado fora do render)
    // =========================
    useEffect(() => {
        if (!isModalOpen) {
            setDistrictLoading(false);
            return;
        }

        if (!activeDistrict || !poiAllPT) {
            setPoiForActive(null);
            setDistrictLoading(false);
            return;
        }

        const key = getDistrictKeyFromFeature(activeDistrict);
        if (!key) {
            setPoiForActive(null);
            setDistrictLoading(false);
            return;
        }

        // cache em memória
        const hit = poiCacheRef.current.get(key);
        if (hit) {
            setPoiForActive(hit);
            setDistrictLoading(false);
            return;
        }

        setDistrictLoading(true);

        // empurrar o trabalho pesado para depois do paint (spinner)
        const handle = window.setTimeout(() => {
            const filtered = filterPointsInsideDistrict(poiAllPT, activeDistrict);
            const safe = filtered || { type: "FeatureCollection", features: [] };
            poiCacheRef.current.set(key, safe);
            setPoiForActive(safe);
            setDistrictLoading(false);
        }, 0);

        return () => {
            window.clearTimeout(handle);
        };
    }, [activeDistrict, poiAllPT, isModalOpen]);

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

            const topbar = document.querySelector<HTMLElement>(".top-district-filter");
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
    const dataReady = Boolean(ptGeo && districtsGeo && poiAllPT);
    const showOverlay = !dataReady || poisLoading;

    // =========================
    //          Render
    // =========================
    return (
        <>
            {showOverlay && <LoadingOverlay message="A carregar os seus dados" />}

            {/* Spinner enquanto o distrito selecionado prepara os POIs */}
            <SpinnerOverlay
                open={districtLoading}
                message="A carregar distrito…"
            />

            {!isModalOpen && (
                <div className="top-district-filter">
                    <div className="tdf-inner">
                        <TopDistrictFilter
                            allNames={districtNames}
                            poiGeo={poiAllPT}
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
                    <Pane name="worldBase" style={{ zIndex: 200, pointerEvents: "none" }}>
                        <TileLayer
                            url={WORLD_BASE}
                            attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            noWrap
                        />
                    </Pane>

                    <Pane name="worldLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
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
                open={isModalOpen && !districtLoading} // 👈 só abre quando os POIs do distrito estiverem prontos
                onClose={handleCloseModal}
                districtFeature={activeDistrict}
                selectedTypes={selectedPoiTypes}
                onToggleType={togglePoiType}
                onClearTypes={clearPoiTypes}
                poiPoints={poiForActive}
                population={null}
            />
        </>
    );
}

/** Converte GeoJSON em poly:"lat lon ..." para Overpass */
function geoToOverpassPoly(geo: any): string | null {
    const rings: number[][][] = [];
    const pushFeature = (f: any) => {
        const g = f.geometry || f;
        if (!g) return;
        if (g.type === "Polygon") {
            if (Array.isArray(g.coordinates?.[0])) rings.push(g.coordinates[0]);
        } else if (g.type === "MultiPolygon") {
            for (const poly of g.coordinates || []) {
                if (Array.isArray(poly?.[0])) rings.push(poly[0]);
            }
        }
    };

    if (geo?.type === "FeatureCollection") {
        for (const f of geo.features || []) pushFeature(f);
    } else if (geo?.type === "Feature") {
        pushFeature(geo);
    } else if (geo) {
        pushFeature(geo);
    }

    if (!rings.length) return null;
    const parts: string[] = [];
    for (const ring of rings) {
        for (const [lng, lat] of ring) {
            parts.push(`${lat} ${lng}`);
        }
    }
    return `poly:"${parts.join(" ")}"`;
}