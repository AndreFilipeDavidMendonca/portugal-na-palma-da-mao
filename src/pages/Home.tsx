import { MapContainer, TileLayer, GeoJSON, Pane } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import DistrictModal from "@/features/map/DistrictModal";
import {
    featureToOverpassPoly,
    overpassQueryToGeoJSON,
    buildCulturalPointsQuery,
    fetchDistrictBasemap,           // <-- NOVO
} from "@/lib/overpass";
import {
    WORLD_BASE, WORLD_LABELS,
    DEFAULT_POI_TYPES, type PoiCategory
} from "@/utils/constants";
import { getDistrictKeyFromFeature } from "@/utils/geo";

type AnyGeo = any;

type BasemapBundle = {
    rivers: AnyGeo | null;
    lakes: AnyGeo | null;
    rail: AnyGeo | null;
    roads: AnyGeo | null;
    peaks: AnyGeo | null;
    places: AnyGeo | null;
};

export default function Home() {
    const [pt, setPt] = useState<AnyGeo>(null);
    const [distritos, setDistritos] = useState<AnyGeo>(null);

    // modal
    const [open, setOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState<any | null>(null);

    // filtros de POIs
    const [selectedTypes, setSelectedTypes] = useState<Set<PoiCategory>>(new Set(DEFAULT_POI_TYPES));

    // POIs culturais
    const [poiPoints, setPoiPoints] = useState<AnyGeo | null>(null);

    // Basemap do distrito (rios, lagos, rail, roads, peaks, places)
    const [basemap, setBasemap] = useState<BasemapBundle>({
        rivers: null, lakes: null, rail: null, roads: null, peaks: null, places: null
    });

    // cache
    const poiCache = useRef(new Map<string, AnyGeo>());
    const baseCache = useRef(new Map<string, BasemapBundle>());
    const lastKeyRef = useRef<string | null>(null);

    useEffect(() => {
        loadGeo("/geo/portugal.geojson").then(setPt);
        loadGeo("/geo/distritos.geojson").then(setDistritos).catch(() => {});
    }, []);

    const onToggleType = (k: PoiCategory) => {
        setSelectedTypes(prev => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };
    const onClearTypes = () => setSelectedTypes(new Set());

    async function openDistrict(feature: any) {
        setActiveFeature(feature);
        setOpen(true);

        const key = getDistrictKeyFromFeature(feature);
        lastKeyRef.current = key || null;

        const poly = featureToOverpassPoly(feature);
        if (!poly) return;

        // — POIs (culturais) com cache
        if (key && poiCache.current.has(key)) {
            setPoiPoints(poiCache.current.get(key) || null);
        } else {
            const pointsQuery = buildCulturalPointsQuery(poly);
            try {
                const points = await overpassQueryToGeoJSON(pointsQuery, 2);
                if (key) poiCache.current.set(key, points);
                setPoiPoints(points);
            } catch (e) {
                console.error("Overpass (POIs):", e);
                setPoiPoints(null);
            }
        }

        // — Basemap (rios/lagos/rail/roads/peaks/places) com cache
        if (key && baseCache.current.has(key)) {
            setBasemap(baseCache.current.get(key)!);
        } else {
            try {
                const data = await fetchDistrictBasemap(poly);
                if (key) baseCache.current.set(key, data);
                setBasemap(data);
            } catch (e) {
                console.error("Overpass (basemap):", e);
                setBasemap({ rivers: null, lakes: null, rail: null, roads: null, peaks: null, places: null });
            }
        }
    }

    function closeAndClear() {
        setOpen(false);
        setActiveFeature(null);
        setPoiPoints(null);
        setBasemap({ rivers: null, lakes: null, rail: null, roads: null, peaks: null, places: null });
        lastKeyRef.current = null;
    }

    return (
        <>
            <MapContainer
                center={[39.5, -8]}
                zoom={6}
                scrollWheelZoom
                attributionControl
                preferCanvas
                style={{ height: "100vh", width: "100vw" }}
            >
                <Pane name="worldBase" style={{ zIndex: 200, pointerEvents: "none" }}>
                    <TileLayer url={WORLD_BASE}
                               attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                </Pane>
                <Pane name="worldLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                    <TileLayer url={WORLD_LABELS} attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' />
                </Pane>

                {pt && (
                    <GeoJSON
                        data={pt as any}
                        style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                        interactive={false}
                    />
                )}

                {distritos && (
                    <DistrictsHoverLayer
                        data={distritos as any}
                        onClickDistrict={(name, feature) => {
                            console.log('click distrito:', name); // debug
                            feature && openDistrict(feature);
                        }}
                    />
                )}
            </MapContainer>

            <DistrictModal
                open={open}
                onClose={closeAndClear}
                districtFeature={activeFeature}

                // filtros (painel direito)
                selectedTypes={selectedTypes}
                onToggleType={onToggleType}
                onClearTypes={onClearTypes}

                // dados (POIs culturais)
                poiPoints={poiPoints}

                // basemap do distrito (NOVO)
                rivers={basemap.rivers}
                lakes={basemap.lakes}
                rail={basemap.rail}
                roads={basemap.roads}
                peaks={basemap.peaks}
                places={basemap.places}

                population={null}
            />
        </>
    );
}