import { MapContainer, TileLayer, Pane, useMap } from "react-leaflet";
import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { buildCulturalPointsQuery, overpassQueryToGeoJSON } from "@/lib/overpass";
import { WORLD_BASE, WORLD_LABELS, type PoiCategory } from "@/utils/constants";
import { getDistrictKeyFromFeature } from "@/utils/geo";
import { filterPointsInsideDistrict } from "@/lib/spatial";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/features/map/LoadingOverlay";

type AnyGeo = any;

export default function Home() {
    // Geometrias base
    const [pt, setPt] = useState<AnyGeo>(null);
    const [distritos, setDistritos] = useState<AnyGeo>(null);

    // Filtros
    const [selectedTypes, setSelectedTypes] = useState<Set<PoiCategory>>(new Set());

    // POIs Overpass (filtramos por distrito depois)
    const [allPoiPoints, setAllPoiPoints] = useState<AnyGeo | null>(null);

    // Loading flags
    const [isGeoLoading, setIsGeoLoading] = useState(true);
    const [isOverpassLoading, setIsOverpassLoading] = useState(false);

    // ⏱️ tempo mínimo do overlay
    const MIN_OVERLAY_MS = 1000;                       // <- ajusta aqui (12s)
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMinTimeElapsed(true), MIN_OVERLAY_MS);
        return () => clearTimeout(t);
    }, []);

    // mantém o “min spinner” do overpass (não conflita com o mínimo global)
    const overlayStartRef = useRef<number>(0);
    const MIN_SPINNER_MS = 900;

    // Modal
    const [open, setOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState<any | null>(null);

    // Cache por distrito
    const districtPointsCache = useRef(new Map<string, AnyGeo>());

    // 1) Carregar Portugal + Distritos
    useEffect(() => {
        let aborted = false;
        setIsGeoLoading(true);

        Promise.all([
            loadGeo("/geo/portugal.geojson"),
            loadGeo("/geo/distritos.geojson").catch(() => null),
        ])
            .then(([ptData, distData]) => {
                if (aborted) return;
                setPt(ptData);
                setDistritos(distData);
            })
            .catch((e) => console.error("[geo] Falha ao carregar PT/distritos:", e))
            .finally(() => !aborted && setIsGeoLoading(false));

        return () => { aborted = true; };
    }, []);

    // 2) Overpass assim que tivermos PT
    useEffect(() => {
        if (!pt) return;

        const poly = geoToOverpassPoly(pt);
        if (!poly) {
            console.warn("[overpass] poly não gerada (geo inválido?)");
            return;
        }

        const q = buildCulturalPointsQuery(poly);
        const controller = new AbortController();

        overlayStartRef.current = performance.now();
        setIsOverpassLoading(true);

        overpassQueryToGeoJSON(q, 2, controller.signal)
            .then((gj) => setAllPoiPoints(gj))
            .catch((e) => {
                if (e?.name !== "AbortError") console.error("[overpass] falhou:", e);
                setAllPoiPoints(null);
            })
            .finally(() => {
                const elapsed = performance.now() - overlayStartRef.current;
                const waitMore = Math.max(0, MIN_SPINNER_MS - elapsed);
                window.setTimeout(() => setIsOverpassLoading(false), waitMore);
            });

        return () => controller.abort();
    }, [pt]);

    // UI handlers
    function onToggleType(k: PoiCategory) {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }
    function onClearTypes() {
        setSelectedTypes(new Set());
    }
    function openDistrict(feature: any) {
        setActiveFeature(feature);
        setOpen(true);
    }

    // Filtra por distrito (com cache)
    const districtPoiPoints = useMemo(() => {
        if (!activeFeature || !allPoiPoints) return null;
        const key = getDistrictKeyFromFeature(activeFeature);
        if (!key) return null;

        const hit = districtPointsCache.current.get(key);
        if (hit) return hit;

        const filtered = filterPointsInsideDistrict(allPoiPoints, activeFeature);
        districtPointsCache.current.set(key, filtered || { type: "FeatureCollection", features: [] });
        return filtered;
    }, [activeFeature, allPoiPoints]);

    // 👇 overlay visível enquanto houver loading real OU até cumprir o mínimo
    const showOverlay = (isGeoLoading || isOverpassLoading) || !minTimeElapsed;
    const mapInteractive = !showOverlay;

    return (
        <>
            {showOverlay && <LoadingOverlay />}

            <div className={`map-shell ${mapInteractive ? "" : "blocked"}`}>
                <MapContainer
                    center={[39.7, -8.1]}
                    zoom={1}
                    scrollWheelZoom={mapInteractive}
                    dragging={mapInteractive}
                    doubleClickZoom={mapInteractive}
                    attributionControl
                    preferCanvas
                    style={{ height: "100vh", width: "100vw" }}
                >
                    <Pane name="worldBase" style={{ zIndex: 200, pointerEvents: "none" }}>
                        <TileLayer
                            url={WORLD_BASE}
                            attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                    </Pane>
                    <Pane name="worldLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                        <TileLayer
                            url={WORLD_LABELS}
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                    </Pane>

                    {/* Fit com ilhas garantidas */}
                    <FitPortugalIslands />

                    {distritos && (
                        <DistrictsHoverLayer
                            data={distritos as any}
                            onClickDistrict={(_name, feature) => feature && openDistrict(feature)}
                        />
                    )}
                </MapContainer>
            </div>

            <DistrictModal
                open={open}
                onClose={() => setOpen(false)}
                districtFeature={activeFeature}
                selectedTypes={selectedTypes}
                onToggleType={onToggleType}
                onClearTypes={onClearTypes}
                poiPoints={districtPoiPoints}
                population={null}
            />

            <style>{`
        .map-shell.blocked { pointer-events: none; }
      `}</style>
        </>
    );
}

/** Fit fixo que inclui Açores e Madeira (independente do GeoJSON) */
function FitPortugalIslands() {
    const map = useMap();
    const did = useRef(false);

    useEffect(() => {
        if (did.current) return;

        const portugalBounds = L.latLngBounds(
            [32.0, -32.0],
            [43.0,  -6.0]
        );

        map.fitBounds(portugalBounds, {
            animate: false,
            paddingTopLeft: [20, 60],
            paddingBottomRight: [20, 20],
        });
        map.setMaxBounds(portugalBounds.pad(0.3));

        map.whenReady(() => {
            setTimeout(() => {
                map.invalidateSize();
                map.fitBounds(portugalBounds, {
                    animate: false,
                    paddingTopLeft: [20, 60],
                    paddingBottomRight: [20, 20],
                });
            }, 0);
        });

        did.current = true;
    }, [map]);

    return null;
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