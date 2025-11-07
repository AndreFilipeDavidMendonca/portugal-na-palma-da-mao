// src/pages/Home.tsx
import { MapContainer, TileLayer, Pane } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { buildCulturalPointsQuery, overpassQueryToGeoJSON } from "@/lib/overpass";
import { WORLD_BASE, WORLD_LABELS, type PoiCategory } from "@/utils/constants";
import { getDistrictKeyFromFeature } from "@/utils/geo";
import { filterPointsInsideDistrict } from "@/lib/spatial";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/features/map/LoadingOverlay";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";

type AnyGeo = any;

export default function Home() {
    // ----- Estado base -----
    const [ptGeo, setPtGeo] = useState<AnyGeo>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo>(null);

    // Mundo visível sem repetição
    const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);

    // ----- Filtros POI -----
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(new Set());

    // ----- POIs (Overpass, scope: PT) -----
    const [poiAllPT, setPoiAllPT] = useState<AnyGeo | null>(null);

    // ----- Loading + overlay mínimo -----
    const [isGeoLoading, setIsGeoLoading] = useState(true);
    const [isOverpassLoading, setIsOverpassLoading] = useState(false);
    const [overlayMinElapsed, setOverlayMinElapsed] = useState(false);
    const overlayStartRef = useRef<number>(0);

    useEffect(() => {
        const MIN_OVERLAY_MS = 1000;
        const t = setTimeout(() => setOverlayMinElapsed(true), MIN_OVERLAY_MS);
        return () => clearTimeout(t);
    }, []);
    const showOverlay = (isGeoLoading || isOverpassLoading) || !overlayMinElapsed;

    // ----- Modal de Distrito -----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrict, setActiveDistrict] = useState<any | null>(null);

    // Cache de POIs por distrito
    const poiCacheRef = useRef(new Map<string, AnyGeo>());

    // Map ref (usado com ref={mapRef})
    const mapRef = useRef<L.Map | null>(null);

    // =========================
    //   Carregamento de dados
    // =========================
    useEffect(() => {
        let aborted = false;
        setIsGeoLoading(true);

        Promise.all([
            loadGeo("/geo/portugal.geojson"),
            loadGeo("/geo/distritos.geojson").catch(() => null),
        ])
            .then(([ptData, distData]) => {
                if (aborted) return;
                setPtGeo(ptData);
                setDistrictsGeo(distData);
            })
            .catch((e) => console.error("[geo] Falha ao carregar PT/distritos:", e))
            .finally(() => !aborted && setIsGeoLoading(false));

        return () => { aborted = true; };
    }, []);

    useEffect(() => {
        if (!ptGeo) return;

        const poly = geoToOverpassPoly(ptGeo);
        if (!poly) {
            console.warn("[overpass] poly não gerada");
            return;
        }

        const q = buildCulturalPointsQuery(poly);
        const controller = new AbortController();

        overlayStartRef.current = performance.now();
        setIsOverpassLoading(true);

        overpassQueryToGeoJSON(q, 2, controller.signal)
            .then((gj) => setPoiAllPT(gj))
            .catch((e) => {
                if (e?.name !== "AbortError") console.error("[overpass] falhou:", e);
                setPoiAllPT(null);
            })
            .finally(() => {
                const MIN_SPINNER_MS = 900;
                const elapsed = performance.now() - overlayStartRef.current;
                const waitMore = Math.max(0, MIN_SPINNER_MS - elapsed);
                window.setTimeout(() => setIsOverpassLoading(false), waitMore);
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
    }

    // nome → feature (para a barra do topo)
    const featureByName = useMemo(() => {
        const m = new Map<string, any>();
        if (districtsGeo?.features) {
            for (const f of districtsGeo.features) {
                const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"];
                if (name) m.set(name, f);
            }
        }
        return m;
    }, [districtsGeo]);

    const districtNames = useMemo(
        () => Array.from(featureByName.keys()).sort((a, b) =>
            a.localeCompare(b, "pt-PT", { sensitivity: "base" })),
        [featureByName]
    );

    // Pick vindo do topo: centra e abre modal
    function handlePickFromTop(name: string) {
        const f = featureByName.get(name);
        if (!f) return;
        zoomToFeatureBounds(f);
        openDistrictModal(f);
    }

    // Fechar modal: recentra PT
    function handleCloseModal() {
        setIsModalOpen(false);
        setActiveDistrict(null);
        if (mapRef.current && ptGeo) fitGeoJSONBoundsTight(mapRef.current, ptGeo);
    }

    // =========================
    //   POIs do distrito ativo
    // =========================
    const poiForActive = useMemo(() => {
        if (!activeDistrict || !poiAllPT) return null;
        const key = getDistrictKeyFromFeature(activeDistrict);
        if (!key) return null;

        const hit = poiCacheRef.current.get(key);
        if (hit) return hit;

        const filtered = filterPointsInsideDistrict(poiAllPT, activeDistrict);
        const safe = filtered || { type: "FeatureCollection", features: [] };
        poiCacheRef.current.set(key, safe);
        return safe;
    }, [activeDistrict, poiAllPT]);

    // =========================
    //         Map utils
    // =========================
    function onMapReady(map: L.Map) {
        // Fit inicial apenas UMA vez
        if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, false);
    }

    /** Centraliza e aproxima ao máximo, respeitando a UI do topo (logo + barra) */
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

            const SIDE_PAD = 10;        // px
            const TOP_PAD = topH + 50;  // px
            const BOT_PAD = 10;         // px

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
    //          Render
    // =========================
    return (
        <>
            {showOverlay && <LoadingOverlay />}

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
                    ref={mapRef}                        // <- usamos ref para obter o Map
                    center={[30, 0]}
                    zoom={3}
                    whenReady={() => {                  // <- whenReady sem argumentos (corrige TS)
                        if (mapRef.current) onMapReady(mapRef.current);
                    }}
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
                            onClickDistrict={(_name, feature) => feature && openDistrictModal(feature)}
                        />
                    )}
                </MapContainer>
            </div>

            <DistrictModal
                open={isModalOpen}
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
    if (geo?.type === "FeatureCollection") for (const f of geo.features || []) pushFeature(f);
    else if (geo?.type === "Feature") pushFeature(geo);
    else if (geo) pushFeature(geo);

    if (!rings.length) return null;
    const parts: string[] = [];
    for (const ring of rings) for (const [lng, lat] of ring) parts.push(`${lat} ${lng}`);
    return `poly:"${parts.join(" ")}"`;
}