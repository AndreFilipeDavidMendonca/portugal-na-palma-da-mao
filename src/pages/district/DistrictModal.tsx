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
    type PoiCategory,
} from "@/utils/constants";

import { PoiPointsLayer, PoiAreasLayer, filterFeaturesByTypes, getPoiCategory } from "@/features/map/PoiLayers";
import PoiFilter from "@/features/filters/PoiFilter";

type AnyGeo = any;

type Props = {
    open: boolean;
    onClose: () => void;
    districtFeature: AnyGeo | null;

    // filtros culturais
    selectedTypes: Set<PoiCategory>;
    onToggleType: (k: PoiCategory) => void;
    onClearTypes: () => void;

    // dados (POIs culturais vindos do Overpass)
    poiPoints: AnyGeo | null;
    poiAreas?: AnyGeo | null;
    population?: number | null;

    // camadas opcionais
    rivers?: AnyGeo | null;
    lakes?: AnyGeo | null;
    rails?: AnyGeo | null;
    roads?: AnyGeo | null;
    peaks?: AnyGeo | null;
    places?: AnyGeo | null;
};

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

export default function DistrictModal({
                                          open,
                                          onClose,
                                          districtFeature,
                                          selectedTypes,
                                          onToggleType,
                                          onClearTypes,
                                          poiPoints,
                                          poiAreas = null,
                                          population = null,
                                          rivers: riversProp = null,
                                          lakes: lakesProp = null,
                                          rails: railsProp = null,
                                          roads: roadsProp = null,
                                          peaks: peaksProp = null,
                                          places: placesProp = null,
                                      }: Props) {
    const [rivers, setRivers] = useState<AnyGeo | null>(riversProp);
    const [lakes, setLakes] = useState<AnyGeo | null>(lakesProp);
    const [rails, setRails] = useState<AnyGeo | null>(railsProp);
    const [roads, setRoads] = useState<AnyGeo | null>(roadsProp);
    const [peaks, setPeaks] = useState<AnyGeo | null>(peaksProp);
    const [places, setPlaces] = useState<AnyGeo | null>(placesProp);
    const [districtInfo, setDistrictInfo] = useState<any>(null);

    useEffect(() => {
        if (!districtFeature?.properties?.name) return;
        const name = districtFeature.properties.name;
        import("@/lib/districtInfo").then(({ fetchDistrictInfo }) => {
            fetchDistrictInfo(name).then(setDistrictInfo);
        });
    }, [districtFeature]);

    // Carrega camadas se não vierem por props
    useEffect(() => {
        const safeLoad = async (path: string, setter: (gj: AnyGeo | null) => void, already: AnyGeo | null) => {
            if (already) return;
            try {
                const gj = await loadGeo(path);
                if (gj && (gj.type === "FeatureCollection" || gj.type === "Feature")) setter(gj);
                else setter(null);
            } catch {
                setter(null);
            }
        };

        safeLoad("/geo/rios_pt.geojson", setRivers, riversProp);
        safeLoad("/geo/lagos_pt.geojson", setLakes, lakesProp);
        safeLoad("/geo/ferrovias_pt.geojson", setRails, railsProp);
        safeLoad("/geo/estradas_pt.geojson", setRoads, roadsProp);
        safeLoad("/geo/picos_pt.geojson", setPeaks, peaksProp);
        safeLoad("/geo/cidades_pt.geojson", setPlaces, placesProp);
    }, []);

    const filteredPoints = useMemo(() => {
        if (!poiPoints) return null;

        const filtered = filterFeaturesByTypes(poiPoints, selectedTypes);

        const withNames = {
            ...filtered,
            features: filtered.features?.filter(
                (f: any) =>
                    !!(
                        f.properties?.name ||
                        f.properties?.["name:pt"] ||
                        f.properties?.NAME
                    )
            ),
        };
        console.debug(
            `POIs filtrados: ${filtered.features?.length} de ${poiPoints?.features?.length}`
        );
        return withNames;
    }, [poiPoints, selectedTypes]);

    const countsByCat = useMemo(() => {
        const counts: Record<PoiCategory, number> = {} as any;
        for (const f of poiPoints?.features ?? []) {
            const cat = getPoiCategory(f);
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        }
        return counts;
    }, [poiPoints]);

    if (!open) return null;

    return (
        <div className="district-modal theme-dark">
            {/* barra de filtros no topo do modal */}
            <div className="poi-top">
                <PoiFilter
                    variant="top"
                    selected={selectedTypes}
                    onToggle={onToggleType}
                    onClear={onClearTypes}
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

                        {districtFeature && (
                            <GeoJSON
                                data={districtFeature as any}
                                style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                                interactive={false}
                            />
                        )}

                        {rivers && (
                            <Pane name="rivers" style={{ zIndex: Z_RIVERS }}>
                                <GeoJSON data={rivers as any} style={{ color: COLOR_RIVER, weight: 1.5, opacity: 0.9 }} interactive={false} />
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

                        {poiAreas && (
                            <Pane name="areas" style={{ zIndex: 430 }}>
                                <PoiAreasLayer data={poiAreas} />
                            </Pane>
                        )}

                        {filteredPoints && (
                            <Pane name="points" style={{ zIndex: 460 }}>
                                <PoiPointsLayer data={filteredPoints} selectedTypes={selectedTypes} />
                            </Pane>
                        )}

                        <FitDistrictBounds feature={districtFeature} />
                    </MapContainer>
                </div>

                <aside className="right-panel">
                    <div className="right-inner">
                        <h2>{districtFeature?.properties?.name || "Distrito"}</h2>
                        <hr />
                        {districtInfo && (
                            <div className="district-info">
                                <div><strong>Fundado:</strong> {districtInfo.founded || "—"}</div>
                                <div><strong>População:</strong> {population?.toLocaleString("pt-PT") || "—"}</div>
                                <p>{districtInfo.description}</p>
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* estilos mínimos */}
            <style>{`
        .district-modal{
          position:fixed; inset:0; background:rgba(255,255,255,.98);
          z-index:9999; display:flex; flex-direction:column;
        }
        .modal-close{
          position:absolute; top:16px; right:16px; z-index:10001;
          width:40px; height:40px; border-radius:50%;
          border:1px solid #ddd; background:#fff; font-size:22px; line-height:38px;
          cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.08);
        }
        .modal-content{ flex:1; display:grid; grid-template-columns: 1fr 380px; gap:0; height:100%; }
        .left-map{ position:relative; }
        .right-panel{ background:#fff; border-left:1px solid #eee; overflow:auto; }
        .right-inner{ padding:18px 16px 24px; }
        .meta{ display:grid; gap:6px; margin-bottom:8px; color:#333 }
        .filters-grid{
          display:grid; grid-template-columns:1fr; gap:8px; margin-bottom:10px;
        }
        .filter-chip{
          display:flex; align-items:center; gap:8px;
          border:1px solid #E0E0E0; border-radius:12px; padding:10px 12px;
          background:#fff;
        }
        .filter-chip.on{ background:#F3F6FF; border-color:#C5CAE9; }
        .filter-chip input{ width:16px; height:16px; }
        .filter-chip em{ margin-left:auto; font-style:normal; opacity:.65; }
        .btn-clear{
          margin-top:6px; padding:8px 10px; border:1px solid #ddd; border-radius:10px;
          background:#fff; cursor:pointer;
        }
        .place-label span{
          font: 600 11px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          color:#333; text-shadow:0 1px 2px rgba(255,255,255,.8);
          white-space: nowrap;
        }
      `}</style>
        </div>
    );
}