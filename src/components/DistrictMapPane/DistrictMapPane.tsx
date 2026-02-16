// src/components/DistrictMapPane/DistrictMapPane.tsx
import React, { useEffect, useRef } from "react";
import { GeoJSON, MapContainer, Pane, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import {
    COLOR_LAKE,
    COLOR_PEAK,
    COLOR_RAIL,
    COLOR_RIVER,
    COLOR_ROAD,
    DISTRICT_DETAIL,
    DISTRICT_LABELS,
    type PoiCategory,
    Z_LAKES,
    Z_PEAKS,
    Z_PLACES,
    Z_RAIL,
    Z_RIVERS,
    Z_ROADS,
} from "@/utils/constants";

import { PoiAreasLayer, PoiPointsLayer } from "@/features/map/PoiLayers";

import "./DistrictMapPane.scss";

type AnyGeo = any;

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
    districtFeature: AnyGeo | null;

    rivers?: AnyGeo | null;
    lakes?: AnyGeo | null;
    rails?: AnyGeo | null;
    roads?: AnyGeo | null;
    peaks?: AnyGeo | null;
    places?: AnyGeo | null;

    poiAreas?: AnyGeo | null;
    filteredPoints?: AnyGeo | null;

    // ✅ era Set -> agora ReadonlySet (corrige TS2739)
    selectedTypes: ReadonlySet<PoiCategory>;
    renderNonce: number;

    onPoiClick: (feature: any) => void;
};

export default function DistrictMapPane({
                                            districtFeature,
                                            rivers = null,
                                            lakes = null,
                                            rails = null,
                                            roads = null,
                                            peaks = null,
                                            places = null,
                                            poiAreas = null,
                                            filteredPoints = null,
                                            selectedTypes,
                                            renderNonce,
                                            onPoiClick,
                                        }: Props) {
    return (
        <div className="district-map-pane">
            <MapContainer
                center={[39.5, -8]}
                zoom={8}
                scrollWheelZoom
                attributionControl
                preferCanvas
                style={{ height: "100%", width: "100%" }}
            >
                <Pane name="districtBase" style={{ zIndex: 200 }}>
                    <TileLayer url={DISTRICT_DETAIL} />
                </Pane>

                <Pane name="districtLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
                    <TileLayer url={DISTRICT_LABELS} />
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
                        <GeoJSON data={rivers as any} style={{ color: COLOR_RIVER, weight: 1.5 }} interactive={false} />
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
                        <GeoJSON
                            data={rails as any}
                            style={{ color: COLOR_RAIL, weight: 1, dashArray: "4,3", opacity: 0.9 }}
                            interactive={false}
                        />
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
                                const name = f?.properties?.NAME ?? f?.properties?.name ?? f?.properties?.["name:pt"] ?? null;
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
                        <PoiPointsLayer
                            data={filteredPoints}
                            selectedTypes={selectedTypes}
                            nonce={renderNonce}
                            onSelect={onPoiClick}
                        />
                    </Pane>
                )}

                <FitDistrictBounds feature={districtFeature} />
            </MapContainer>
        </div>
    );
}