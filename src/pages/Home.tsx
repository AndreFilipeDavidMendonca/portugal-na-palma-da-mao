import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useState } from 'react'
import { loadGeo } from '@/lib/geo'
import DistrictsHoverLayer from '@/features/map/DistrictsHoverLayer'

type AnyGeo = any

function FitToPortugal({ geo }: { geo: AnyGeo }) {
    const map = useMap()
    useEffect(() => {
        if (!geo) return
        const gj = L.geoJSON(geo)
        const b = gj.getBounds()
        map.fitBounds(b, { padding: [20, 20] })
        map.setMaxBounds(b.pad(0.25))
    }, [geo, map])
    return null
}

export default function Home() {
    const [pt, setPt] = useState<AnyGeo>(null)
    const [distritos, setDistritos] = useState<AnyGeo>(null)

    useEffect(() => {
        loadGeo('/geo/portugal.geojson').then(setPt)
        loadGeo('/geo/distritos.geojson').then(setDistritos).catch(() => {})
    }, [])

    return (
        <MapContainer
            center={[39.5, -8]}
            zoom={6}
            scrollWheelZoom
            attributionControl
            preferCanvas
            style={{ height: "100vh", width: "100vw" }}
            whenCreated={(map) => {
                if (!map.getPane("worldBase")) {
                    const p = map.createPane("worldBase");
                    p.classList.add("world-base");
                    p.style.zIndex = "200"; // debaixo das linhas/GeoJSON
                    p.style.pointerEvents = "none";
                }
                if (!map.getPane("worldLabels")) {
                    const p = map.createPane("worldLabels");
                    p.classList.add("world-labels");
                    p.style.zIndex = "210";
                    p.style.pointerEvents = "none";
                }
            }}
        >
            {/* Mundo MUITO leve, sem labels */}
            <TileLayer
                pane="worldBase"
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {/* Só labels (inclui países) por cima, também suavizadas */}
            <TileLayer
                pane="worldLabels"
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            />

            {/* Portugal outline */}
            {pt && (
                <GeoJSON
                    data={pt as any}
                    style={() => ({ color: '#2E7D32', weight: 2, fillOpacity: 0, smoothFactor: 2 })}
                    interactive={false}
                />
            )}

            {/* Districts (always visible, bold on hover) */}
            {distritos && (
                <DistrictsHoverLayer
                    data={distritos as any}
                    onClickDistrict={(name) => console.log('Distrito:', name)}
                />
            )}

            {pt && <FitToPortugal geo={pt} />}
        </MapContainer>
    )
}