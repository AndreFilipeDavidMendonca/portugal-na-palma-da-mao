// src/pages/Home.tsx
import {MapContainer, TileLayer, GeoJSON, Pane, useMap} from "react-leaflet";
import {useEffect, useRef, useState, useMemo} from "react";
import L from "leaflet";
import {loadGeo} from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import {buildCulturalPointsQuery, overpassQueryToGeoJSON} from "@/lib/overpass";
import {WORLD_BASE, WORLD_LABELS, DEFAULT_POI_TYPES, type PoiCategory} from "@/utils/constants";
import {getDistrictKeyFromFeature} from "@/utils/geo";
import {filterPointsInsideDistrict} from "@/lib/spatial";
import DistrictModal from "@/features/map/DistrictModal";

type AnyGeo = any;

export default function Home() {
    // base
    const [pt, setPt] = useState<AnyGeo>(null);
    const [distritos, setDistritos] = useState<AnyGeo>(null);

    // filtros (partilhados com o modal)
    const [selectedTypes, setSelectedTypes] = useState<Set<PoiCategory>>(new Set());

    // POIs do país (uma chamada)
    const [allPoiPoints, setAllPoiPoints] = useState<AnyGeo | null>(null);

    // modal
    const [open, setOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState<any | null>(null);

    // cache de pontos por distrito
    const districtPointsCache = useRef(new Map<string, AnyGeo>());
    const [loadingPOIs, setLoadingPOIs] = useState(false);

    useEffect(() => {
        if (!pt) return;
        const poly = geoToOverpassPoly(pt);
        if (!poly) return;

        const q = buildCulturalPointsQuery(poly);
        setLoadingPOIs(true);
        overpassQueryToGeoJSON(q, 2)
            .then(setAllPoiPoints)
            .catch((e) => {
                console.error("Overpass (país) falhou:", e);
                setAllPoiPoints(null);
            })
            .finally(() => setLoadingPOIs(false));
    }, [pt]);

    useEffect(() => {
        loadGeo("/geo/portugal.geojson").then(setPt);
        loadGeo("/geo/distritos.geojson").then(setDistritos).catch(() => {
        });
    }, []);

    // assim que PT carregar, faz query única de pontos culturais
    useEffect(() => {
        if (!pt) return;
        const poly = geoToOverpassPoly(pt);
        if (!poly) return;

        const q = buildCulturalPointsQuery(poly);
        overpassQueryToGeoJSON(q, 2)
            .then((gj) => setAllPoiPoints(gj))
            .catch((e) => {
                console.error("Overpass (país) falhou:", e);
                setAllPoiPoints(null);
            });
    }, [pt]);

    // centra em Portugal (mais próximo e um pouco acima)
    function FitToPortugal({geo}: { geo: any }) {
        const map = useMap();
        const hasFit = useRef(false);

        useEffect(() => {
            if (hasFit.current) return;

            // 🔧 Enquadramento mais próximo:
            // - um pouco mais para a esquerda (mais Atlântico)
            // - menos a Este (menos Espanha)
            // - ligeiro ganho a Norte
            // - mantém Madeira/Açores fora da frame inicial (mas podes navegar até lá)
            const bounds = L.latLngBounds(
                [32.5, -26.0], // mais para sul (mostra mais mar e Madeira no limite)
                [41.0, -5.0]   // corta um pouco o Norte, mantendo fronteira Este
            );
            map.fitBounds(bounds, {
                animate: false,
                // um hair de “zoom in” comparado ao anterior
                paddingTopLeft: [24, 56],
                paddingBottomRight: [24, 20],
            });

            // limites de pan um pouco folgados
            map.setMaxBounds(bounds.pad(0.18));
            hasFit.current = true;
        }, [map]);

        return null;
    }

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

    // filtra pontos do país para o distrito ativo (com cache)
    const districtPoiPoints = useMemo(() => {
        if (!activeFeature || !allPoiPoints) return null;
        const key = getDistrictKeyFromFeature(activeFeature);
        if (!key) return null;

        const hit = districtPointsCache.current.get(key);
        if (hit) return hit;

        const filtered = filterPointsInsideDistrict(allPoiPoints, activeFeature);
        districtPointsCache.current.set(key, filtered || {type: "FeatureCollection", features: []});
        return filtered;
    }, [activeFeature, allPoiPoints]);

    return (
        <>
            <MapContainer
                center={[39.7, -8.1]} // fallback
                zoom={1}
                scrollWheelZoom
                attributionControl
                preferCanvas
                style={{height: "100vh", width: "100vw"}}
            >
                <Pane name="worldBase" style={{zIndex: 200, pointerEvents: "none"}}>
                    <TileLayer url={WORLD_BASE}
                               attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'/>
                </Pane>
                <Pane name="worldLabels" style={{zIndex: 210, pointerEvents: "none"}}>
                    <TileLayer url={WORLD_LABELS}
                               attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'/>
                </Pane>

                {pt && <FitToPortugal geo={pt}/>}

                {distritos && (
                    <DistrictsHoverLayer
                        data={distritos as any}
                        onClickDistrict={(_name, feature) => feature && openDistrict(feature)}
                    />
                )}
            </MapContainer>

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

            {loadingPOIs && (
                <div style={{
                    position: "fixed",
                    right: 16, bottom: 16,
                    background: "rgba(255,255,255,0.92)",
                    borderRadius: 999, padding: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 10000
                }}>
                    <div className="spinner"/>
                    <style>{`
                          .spinner {
                            border: 3px solid #eee;
                            border-top: 3px solid #2E7D32;
                            width: 28px; height: 28px; border-radius: 50%;
                            animation: spin .9s linear infinite;
                          }
                          @keyframes spin { to { transform: rotate(360deg); } }
                        `}</style>
                </div>
            )}
        </>
    );
}

/** Converte GeoJSON (Polygon/MultiPolygon/Feature/FC) em poly:"lat lon ..." para Overpass */
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
    if (geo.type === "FeatureCollection") for (const f of geo.features || []) pushFeature(f);
    else if (geo.type === "Feature") pushFeature(geo);
    else pushFeature(geo);

    if (!rings.length) return null;
    const parts: string[] = [];
    for (const ring of rings) for (const [lng, lat] of ring) parts.push(`${lat} ${lng}`);
    return `poly:"${parts.join(" ")}"`;
}