import { MapContainer, TileLayer, GeoJSON, Pane, Marker } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
    DISTRICT_BASE, DISTRICT_LABELS,
    COLOR_RIVER, COLOR_LAKE, COLOR_RAIL, COLOR_ROAD, COLOR_PEAK,
    Z_RIVERS, Z_LAKES, Z_RAIL, Z_ROADS, Z_PEAKS, Z_PLACES
} from "@/utils/constants";
import { CULTURAL_NODE_TAGS, POI_LABELS } from "@/utils/constants";

type AnyGeo = any;

type Props = {
    open: boolean;
    onClose: () => void;
    districtFeature: AnyGeo | null;

    // filtros
    selectedTypes: Set<string>;
    onToggleType: (k: any) => void;
    onClearTypes: () => void;

    // dados
    poiPoints: AnyGeo | null;
    population: number | null;

    // basemap
    rivers: AnyGeo | null;
    lakes: AnyGeo | null;
    rail: AnyGeo | null;
    roads: AnyGeo | null;
    peaks: AnyGeo | null;
    places: AnyGeo | null;
};

export default function DistrictModal(props: Props) {
    const {
        open, onClose, districtFeature,
        selectedTypes, onToggleType, onClearTypes,
        poiPoints, population,
        rivers, lakes, rail, roads, peaks, places,
    } = props;

    if (!open || !districtFeature) return null;

    const bbox = useMemo(() => {
        const gj = L.geoJSON(districtFeature as any);
        return gj.getBounds();
    }, [districtFeature]);

    const modal = (
        <>
            {/* Overlay para captar cliques fora do modal */}
            <div className="district-modal-overlay" onClick={onClose} />

            <div className="district-modal">
                <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

                <div className="modal-left">
                    <MapContainer
                        bounds={bbox}
                        scrollWheelZoom
                        attributionControl
                        style={{ height: "100%", width: "100%" }}
                    >
                        <TileLayer url={DISTRICT_BASE}
                                   attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                        <TileLayer url={DISTRICT_LABELS} />

                        {/* Contorno distrito */}
                        <GeoJSON data={districtFeature as any}
                                 style={{ color: "#2E7D32", weight: 2, fillOpacity: 0 }} />

                        {/* Rios */}
                        {rivers && (
                            <Pane name="dm_rivers" style={{ zIndex: Z_RIVERS }}>
                                <GeoJSON data={rivers as any}
                                         style={{ color: COLOR_RIVER, weight: 1.5, opacity: 0.9 }} />
                            </Pane>
                        )}

                        {/* Lagos */}
                        {lakes && (
                            <Pane name="dm_lakes" style={{ zIndex: Z_LAKES }}>
                                <GeoJSON data={lakes as any}
                                         style={{ color: COLOR_LAKE, weight: 1, fillColor: COLOR_LAKE, fillOpacity: 0.2 }} />
                            </Pane>
                        )}

                        {/* Ferrovia */}
                        {rail && (
                            <Pane name="dm_rail" style={{ zIndex: Z_RAIL }}>
                                <GeoJSON data={rail as any}
                                         style={{ color: COLOR_RAIL, weight: 1, dashArray: "4 4", opacity: 0.9 }} />
                            </Pane>
                        )}

                        {/* Estradas principais */}
                        {roads && (
                            <Pane name="dm_roads" style={{ zIndex: Z_ROADS }}>
                                <GeoJSON
                                    data={roads as any}
                                    style={(f: any) => {
                                        const hw = f?.properties?.highway || "";
                                        const w =
                                            hw === "motorway" ? 2.5 :
                                                hw === "trunk"    ? 2.0 : 1.6; // primary
                                        return { color: COLOR_ROAD, weight: w, opacity: 0.9 };
                                    }}
                                />
                            </Pane>
                        )}

                        {/* Picos */}
                        {peaks && (
                            <Pane name="dm_peaks" style={{ zIndex: Z_PEAKS }}>
                                <GeoJSON
                                    data={peaks as any}
                                    pointToLayer={(_f, latlng) => {
                                        const icon = L.divIcon({
                                            className: "peak-pin",
                                            html: `<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid ${COLOR_PEAK};"></div>`,
                                            iconSize: [12, 10],
                                            iconAnchor: [6, 10],
                                        });
                                        return L.marker(latlng, { icon });
                                    }}
                                />
                            </Pane>
                        )}

                        {/* Topónimos principais */}
                        {places && (
                            <Pane name="dm_places" style={{ zIndex: Z_PLACES }}>
                                <GeoJSON
                                    data={places as any}
                                    pointToLayer={(f, latlng) => {
                                        const name = f?.properties?.name || f?.properties?.["name:pt"] || f?.properties?.["name:en"] || "";
                                        const cls = f?.properties?.place || "place";
                                        const weight = cls === "city" ? 700 : cls === "town" ? 600 : 500;
                                        const icon = L.divIcon({
                                            className: "place-label",
                                            html: `<span style="font:${weight} 12px/1.2 system-ui; color:#424242; text-shadow:0 1px 2px rgba(255,255,255,.85)">${name}</span>`,
                                            iconSize: [0, 0],
                                        });
                                        return L.marker(latlng, { icon, interactive: false });
                                    }}
                                />
                            </Pane>
                        )}

                        {/* POIs culturais */}
                        {poiPoints && (
                            <GeoJSON
                                data={poiPoints as any}
                                pointToLayer={(_f, latlng) =>
                                    L.circleMarker(latlng, {
                                        radius: 4,
                                        color: "#D32F2F",
                                        weight: 1.5,
                                        fillOpacity: 0.85,
                                    })
                                }
                            />
                        )}
                    </MapContainer>
                </div>

                {/* Direita: infos + filtros */}
                <div className="modal-right">
                    <div className="modal-right-header">
                        <h2>
                            {districtFeature?.properties?.name || districtFeature?.properties?.NAME_1 || "Distrito"}
                        </h2>
                        {typeof population === "number" && (
                            <div className="muted">População: {population.toLocaleString("pt-PT")}</div>
                        )}
                    </div>

                    <div className="filters">
                        <div className="filters-title">Filtros culturais</div>

                        <div className="filters-grid">
                            {CULTURAL_NODE_TAGS.map((k) => {
                                const checked = selectedTypes.has(k);
                                return (
                                    <label key={k} className={`filter-pill ${checked ? "on" : ""}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => onToggleType(k)}
                                        />
                                        <span>{POI_LABELS[k] ?? k}</span>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="filters-actions">
                            <button className="btn-outline" onClick={onClearTypes}>Limpar</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(modal, document.body);
}