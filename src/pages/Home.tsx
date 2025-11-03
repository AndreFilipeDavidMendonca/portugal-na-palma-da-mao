import { MapContainer, TileLayer, GeoJSON, useMap, Pane, CircleMarker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { loadGeo } from '@/lib/geo';
import DistrictsHoverLayer from '@/features/map/DistrictsHoverLayer';

type AnyGeo = any;

function FitToPortugal({ geo }: { geo: AnyGeo }) {
    const map = useMap();
    useEffect(() => {
        if (!geo) return;
        const gj = L.geoJSON(geo);
        const b = gj.getBounds();
        map.fitBounds(b, { padding: [20, 20] });
        map.setMaxBounds(b.pad(0.25));
    }, [geo, map]);
    return null;
}

/** Camada simples de rios (GeoJSON LineString/MultiLineString) */
function RiversInline({ data }: { data: AnyGeo }) {
    return (
        <GeoJSON
            data={data}
            style={(f: any) => ({
                color: '#1E88E5',
                weight: f?.properties?.scalerank <= 2 ? 2.5 : 1.5,
                opacity: 0.9,
            })}
        />
    );
}

/** Lagos (Polygon/MultiPolygon) */
function LakesInline({ data }: { data: AnyGeo }) {
    return (
        <GeoJSON
            data={data}
            style={() => ({
                color: '#1E88E5',
                weight: 1,
                fillColor: '#90CAF9',
                fillOpacity: 0.4,
            })}
        />
    );
}

/** Cidades como CircleMarker com raio aproximado pela população */
function CitiesInline({ data }: { data: AnyGeo }) {
    const feats = data?.features ?? [];
    return (
        <>
            {feats.map((f: any, i: number) => {
                if (!f?.geometry) return null;
                const [lon, lat] = f.geometry.coordinates;
                const name = f.properties?.name || f.properties?.NAME || '—';
                const pop = f.properties?.pop_max ?? f.properties?.POP_MAX ?? 0;
                const r = Math.max(2, Math.min(10, Math.sqrt(Number(pop) || 0) / 400));
                return (
                    <CircleMarker
                        key={i}
                        center={[lat, lon]}
                        radius={r}
                        pathOptions={{ color: '#424242', weight: 1, fillColor: '#616161', fillOpacity: 0.85 }}
                    >
                        <Tooltip direction="top" offset={[0, -2]}>
                            {name}
                        </Tooltip>
                    </CircleMarker>
                );
            })}
        </>
    );
}

/** POI (monumentos) como estrela simples */
function PoiInline({ data }: { data: AnyGeo }) {
    const feats = data?.features ?? [];
    return (
        <>
            {feats.map((f: any, i: number) => {
                if (!f?.geometry) return null;
                const g = f.geometry;
                const [lon, lat] = g.type === 'Point' ? g.coordinates : (g.coordinates?.[0] || [0, 0]);
                const name = f.properties?.name || f.properties?.tags?.name || 'Ponto de interesse';
                return (
                    <CircleMarker
                        key={i}
                        center={[lat, lon]}
                        radius={4}
                        pathOptions={{ color: '#B71C1C', weight: 1.5, fillColor: '#E53935', fillOpacity: 0.9 }}
                    >
                        <Tooltip>{name}</Tooltip>
                        <Popup>
                            <strong>{name}</strong>
                        </Popup>
                    </CircleMarker>
                );
            })}
        </>
    );
}

export default function Home() {
    const [pt, setPt] = useState<AnyGeo>(null);
    const [distritos, setDistritos] = useState<AnyGeo>(null);

    // novas camadas
    const [rios, setRios] = useState<AnyGeo>(null);
    const [lagos, setLagos] = useState<AnyGeo>(null);
    const [cidades, setCidades] = useState<AnyGeo>(null);
    const [poi, setPoi] = useState<AnyGeo>(null);

    useEffect(() => {
        loadGeo('/geo/portugal.geojson').then(setPt);
        loadGeo('/geo/distritos.geojson').then(setDistritos).catch(() => {});

        // estas são opcionais – só aparecem se os ficheiros existirem
        loadGeo('/geo/rios_pt.geojson').then(setRios).catch(() => {});
        loadGeo('/geo/lagos_pt.geojson').then(setLagos).catch(() => {});
        loadGeo('/geo/cidades_pt.geojson').then(setCidades).catch(() => {});
        loadGeo('/geo/poi_pt.geojson').then(setPoi).catch(() => {});
    }, []);

    return (
        <MapContainer
            center={[39.5, -8]}
            zoom={6}
            scrollWheelZoom
            attributionControl
            preferCanvas
            style={{ height: '100vh', width: '100vw' }}
        >
            {/* Mundo discreto */}
            <Pane name="worldBase" style={{ zIndex: 200, pointerEvents: 'none' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
            </Pane>
            <Pane name="worldLabels" style={{ zIndex: 210, pointerEvents: 'none' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
            </Pane>

            {/* Contorno Portugal */}
            {pt && (
                <GeoJSON data={pt as any} style={() => ({ color: '#2E7D32', weight: 2, fillOpacity: 0 })} interactive={false} />
            )}

            {/* Distritos */}
            {distritos && (
                <DistrictsHoverLayer data={distritos as any} onClickDistrict={(n) => console.log('Distrito:', n)} />
            )}

            {/* Rios / Lagos */}
            <Pane name="riversPane" style={{ zIndex: 420 }}>
                {rios && <RiversInline data={rios} />}
                {lagos && <LakesInline data={lagos} />}
            </Pane>

            {/* Cidades */}
            <Pane name="citiesPane" style={{ zIndex: 440 }}>
                {cidades && <CitiesInline data={cidades} />}
            </Pane>

            {/* Pontos de interesse */}
            <Pane name="poiPane" style={{ zIndex: 460 }}>
                {poi && <PoiInline data={poi} />}
            </Pane>

            {pt && <FitToPortugal geo={pt} />}
        </MapContainer>
    );
}