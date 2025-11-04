// src/features/map/DistrictModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import {
    DISTRICT_DETAIL,
    DISTRICT_LABELS,
    POI_LABELS,
    POI_COLORS,
    type PoiCategory,
} from "@/utils/constants";
import { PoiPointsLayer, PoiAreasLayer, filterFeaturesByTypes } from "./PoiLayers";

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
    poiPoints: AnyGeo | null;     // nodes culturais
    poiAreas?: AnyGeo | null;     // parks/protected (opcional)
    population?: number | null;

    // OPCIONAIS: se quiseres injetar camadas vetoriais de fora
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

                                          // opcionais (se vierem, usamos; caso contrário, tentamos carregar de /public/geo/)
                                          rivers: riversProp = null,
                                          lakes: lakesProp = null,
                                          rails: railsProp = null,
                                          roads: roadsProp = null,
                                          peaks: peaksProp = null,
                                          places: placesProp = null,
                                      }: Props) {
    // === Camadas estáticas ===
    const [rivers, setRivers] = useState<AnyGeo | null>(riversProp);
    const [lakes, setLakes] = useState<AnyGeo | null>(lakesProp);
    const [rails, setRails] = useState<AnyGeo | null>(railsProp);
    const [roads, setRoads] = useState<AnyGeo | null>(roadsProp);
    const [peaks, setPeaks] = useState<AnyGeo | null>(peaksProp);
    const [places, setPlaces] = useState<AnyGeo | null>(placesProp);

    // Carrega apenas se não foram passadas via props
    useEffect(() => {
        const safeLoad = async (
            path: string,
            setter: (gj: AnyGeo | null) => void,
            already: AnyGeo | null
        ) => {
            if (already) return; // já veio por props
            try {
                const gj = await loadGeo(path);
                if (gj && (gj.type === "FeatureCollection" || gj.type === "Feature")) {
                    setter(gj);
                } else {
                    setter(null);
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // === Filtro cultural (pontos) ===
    const filteredPoints = useMemo(
        () => filterFeaturesByTypes(poiPoints, selectedTypes),
        [poiPoints, selectedTypes]
    );

    // Contagens por categoria
    const countsByCat = useMemo(() => {
        const counts: Record<PoiCategory, number> = {} as any;
        Array.from(selectedTypes).forEach((k) => (counts[k] = 0));
        if (poiPoints?.features) {
            for (const f of poiPoints.features) {
                const p = f?.properties || {};
                let k: PoiCategory | null = null;
                if (p.historic && selectedTypes.has(p.historic as PoiCategory)) {
                    k = p.historic as PoiCategory;
                } else if (p.tourism && selectedTypes.has(p.tourism as PoiCategory)) {
                    k = p.tourism as PoiCategory;
                }
                if (k) counts[k] = (counts[k] || 0) + 1;
            }
        }
        return counts;
    }, [poiPoints, selectedTypes]);

    if (!open) return null;

    return (
        <div className="district-modal">
            {/* Botão X fixo (fora do MapContainer) */}
            <button
                className="modal-close"
                onClick={onClose}
                aria-label="Fechar"
                title="Fechar"
            >
                ×
            </button>

            <div className="modal-content">
                {/* ESQUERDA: mapa do distrito */}
                <div className="left-map">
                    <MapContainer
                        center={[39.5, -8]}
                        zoom={8}
                        scrollWheelZoom
                        attributionControl
                        preferCanvas
                        style={{ height: "100%", width: "100%" }}
                    >
                        {/* Base detalhada (estradas/rios/landuse) */}
                        <Pane name="districtBase" style={{ zIndex: 200 }}>
                            <TileLayer
                                url={DISTRICT_DETAIL}
                                attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </Pane>
                        {/* Labels por cima */}
                        <Pane name="districtLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                            <TileLayer
                                url={DISTRICT_LABELS}
                                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />
                        </Pane>

                        {/* Limite do distrito */}
                        {districtFeature && (
                            <GeoJSON
                                data={districtFeature as any}
                                style={() => ({ color: "#2E7D32", weight: 2, fillOpacity: 0 })}
                                interactive={false}
                            />
                        )}

                        {/* Rios */}
                        {rivers && (
                            <Pane name="rivers" style={{ zIndex: 420 }}>
                                <GeoJSON
                                    data={rivers as any}
                                    style={{ color: "#1E88E5", weight: 1.5, opacity: 0.9 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Lagos */}
                        {lakes && (
                            <Pane name="lakes" style={{ zIndex: 422 }}>
                                <GeoJSON
                                    data={lakes as any}
                                    style={{
                                        color: "#42A5F5",
                                        weight: 1,
                                        fillColor: "#42A5F5",
                                        fillOpacity: 0.3,
                                        opacity: 0.9,
                                    }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Ferrovias */}
                        {rails && (
                            <Pane name="rails" style={{ zIndex: 424 }}>
                                <GeoJSON
                                    data={rails as any}
                                    style={{ color: "#616161", weight: 1, dashArray: "4,3", opacity: 0.9 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Estradas */}
                        {roads && (
                            <Pane name="roads" style={{ zIndex: 426 }}>
                                <GeoJSON
                                    data={roads as any}
                                    style={{ color: "#F57C00", weight: 1.2, opacity: 0.9 }}
                                    interactive={false}
                                />
                            </Pane>
                        )}

                        {/* Picos / montanhas */}
                        {peaks && (
                            <Pane name="peaks" style={{ zIndex: 428 }}>
                                <GeoJSON
                                    data={peaks as any}
                                    pointToLayer={(_f, latlng) =>
                                        L.circleMarker(latlng, {
                                            radius: 3.5,
                                            color: "#6D4C41",
                                            weight: 1,
                                            fillColor: "#6D4C41",
                                            fillOpacity: 0.9,
                                        })
                                    }
                                />
                            </Pane>
                        )}

                        {/* Cidades / lugares povoados */}
                        {places && (
                            <Pane name="places" style={{ zIndex: 440, pointerEvents: "none" }}>
                                <GeoJSON
                                    data={places as any}
                                    pointToLayer={(f, latlng) => {
                                        const name = f?.properties?.NAME ?? f?.properties?.name ?? null;
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

                        {/* Áreas (parques/protegidas) por baixo dos pontos culturais */}
                        {poiAreas && (
                            <Pane name="areas" style={{ zIndex: 430 }}>
                                <PoiAreasLayer data={poiAreas} />
                            </Pane>
                        )}

                        {/* Pontos culturais filtrados */}
                        {filteredPoints && (
                            <Pane name="points" style={{ zIndex: 460 }}>
                                <PoiPointsLayer data={filteredPoints} selectedTypes={selectedTypes} />
                            </Pane>
                        )}

                        <FitDistrictBounds feature={districtFeature} />
                    </MapContainer>
                </div>

                {/* DIREITA: painel info + filtros */}
                <aside className="right-panel">
                    <div className="right-inner">
                        <h2 style={{ marginTop: 0 }}>
                            {districtFeature?.properties?.name || "Distrito"}
                        </h2>

                        <div className="meta">
                            <div>
                                <strong>Pontos de interesse:</strong>{" "}
                                {filteredPoints?.features?.length ?? 0}
                            </div>
                            {typeof population === "number" && (
                                <div>
                                    <strong>População:</strong> {population.toLocaleString("pt-PT")}
                                </div>
                            )}
                        </div>

                        <hr />

                        <h3 style={{ margin: "12px 0 8px" }}>Filtros culturais</h3>

                        <div className="filters-grid">
                            {(
                                [
                                    "castle",
                                    "monument",
                                    "memorial",
                                    "ruins",
                                    "church",
                                    "museum",
                                    "artwork",
                                    "viewpoint",
                                    "attraction",
                                ] as PoiCategory[]
                            ).map((k) => {
                                const checked = selectedTypes.has(k);
                                const count = countsByCat[k] ?? 0;
                                return (
                                    <label
                                        key={k}
                                        className={`filter-chip ${checked ? "on" : ""}`}
                                        style={{
                                            borderLeft: `8px solid ${POI_COLORS[k] || "#455A64"}`,
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => onToggleType(k)}
                                        />
                                        <span>{POI_LABELS[k]}</span>
                                        <em>{count}</em>
                                    </label>
                                );
                            })}
                        </div>

                        <button className="btn-clear" onClick={onClearTypes}>
                            Limpar
                        </button>
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