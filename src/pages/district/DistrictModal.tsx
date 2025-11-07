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
    PoiPointsLayer,
    PoiAreasLayer,
    getPoiCategory,
} from "@/features/map/PoiLayers";
import PoiFilter from "@/features/filters/PoiFilter";

import "./DistrictModal.scss";

type AnyGeo = any;

/** Mantém o mapa centrado no distrito ativo */
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

    // camadas extra opcionais
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

    // ----- nonce para forçar remount do layer quando limpamos -----
    const [renderNonce, setRenderNonce] = useState(0);

    // camadas base opcionais (lazy se não vierem por props)
    const [rivers, setRivers] = useState<any>(riversProp);
    const [lakes, setLakes] = useState<any>(lakesProp);
    const [rails, setRails] = useState<any>(railsProp);
    const [roads, setRoads] = useState<any>(roadsProp);
    const [peaks, setPeaks] = useState<any>(peaksProp);
    const [places, setPlaces] = useState<any>(placesProp);

    // info do distrito (opcional)
    const [districtInfo, setDistrictInfo] = useState<any>(null);

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

    // lazy load de camadas geográficas (só se não vieram por props)
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

    // 1) Normalização — mescla properties + tags e anota categoria
    const normalizedPoints = useMemo(() => {
        if (!poiPoints) return null;
        const feats = (poiPoints.features ?? []).map((f: any) => {
            const props = { ...(f.properties || {}) };
            const tags = props.tags ?? f.tags ?? {};
            const mergedProps = { ...props, ...tags, tags };
            const nf = { ...f, properties: mergedProps };

            const cat = getPoiCategory(nf);
            if (cat) nf.properties.__cat = cat;

            return nf;
        });
        return { ...poiPoints, features: feats };
    }, [poiPoints]);

    // 2) Contagens por categoria (para o PoiFilter)
    const countsByCat = useMemo<Record<PoiCategory, number>>(() => {
        const counts = Object.create(null) as Record<PoiCategory, number>;
        const allCats = Object.keys(POI_LABELS) as PoiCategory[];
        for (const c of allCats) counts[c] = 0;

        for (const f of normalizedPoints?.features ?? []) {
            const cat = getPoiCategory(f) as PoiCategory | null;
            if (!cat) continue;
            counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalizedPoints]);

    // 3) Aplicação de filtros — se nada selecionado, mostra tudo
    const filteredPoints = useMemo(() => {
        if (!normalizedPoints) return null;
        if (!selectedTypes || selectedTypes.size === 0) return normalizedPoints;

        const feats = normalizedPoints.features.filter((f: any) => {
            const cat = getPoiCategory(f);
            return cat ? selectedTypes.has(cat) : false;
        });
        return { ...normalizedPoints, features: feats };
    }, [normalizedPoints, selectedTypes]);

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
                        onClearTypes();            // limpa no estado pai
                        setRenderNonce((n) => n + 1); // força remount do GeoJSON
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
                            <TileLayer
                                url={DISTRICT_DETAIL}
                                attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </Pane>

                        <Pane name="districtLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                            <TileLayer
                                url={DISTRICT_LABELS}
                                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </Pane>

                        {/* contorno do distrito */}
                        {districtFeature && (
                            <GeoJSON
                                data={districtFeature as any}
                                style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                                interactive={false}
                            />
                        )}

                        {/* camadas extra */}
                        {rivers && (
                            <Pane name="rivers" style={{ zIndex: Z_RIVERS }}>
                                <GeoJSON data={rivers as any} style={{ color: COLOR_RIVER, weight: 1.5, opacity: 0.9 }} interactive={false} />
                            </Pane>
                        )}
                        {lakes && (
                            <Pane name="lakes" style={{ zIndex: Z_LAKES }}>
                                <GeoJSON
                                    data={lakes as any}
                                    style={{ color: COLOR_LAKE, weight: 1, fillColor: COLOR_LAKE, fillOpacity: 0.3, opacity: 0.9 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}
                        {rails && (
                            <Pane name="rails" style={{ zIndex: Z_RAIL }}>
                                <GeoJSON data={rails as any} style={{ color: COLOR_RAIL, weight: 1, dashArray: "4,3", opacity: 0.9 }} interactive={false} />
                            </Pane>
                        )}
                        {roads && (
                            <Pane name="roads" style={{ zIndex: Z_ROADS }}>
                                <GeoJSON data={roads as any} style={{ color: COLOR_ROAD, weight: 1.2, opacity: 0.9 }} interactive={false} />
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
                            <Pane name="places" style={{ zIndex: Z_PLACES, pointerEvents: "none" }}>
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
                                    nonce={renderNonce}        // << força remount quando limpar
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
        </div>
    );
}