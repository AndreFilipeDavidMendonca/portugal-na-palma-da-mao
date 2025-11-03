import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { loadGeo } from '@/lib/geo'
import DistrictsHoverLayer from '@/features/map/DistrictsHoverLayer'

type AnyGeo = any

function extractOuterRings(feature: AnyGeo): [number, number][][] {
    const g = feature.geometry || feature
    if (!g) return []
    if (g.type === 'Polygon') return [g.coordinates[0]]
    if (g.type === 'MultiPolygon') return g.coordinates.map((poly: any) => poly[0])
    return []
}

// máscara: retângulo mundial com “furos” nas anilhas exteriores de Portugal
function buildPortugalMask(pt: AnyGeo) {
    const world: [number, number][] = [
        [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]
    ]
    const holes: [number, number][][] = []

    if (!pt?.type) return null
    if (pt.type === 'FeatureCollection') {
        for (const f of pt.features || []) {
            for (const ring of extractOuterRings(f)) holes.push(ring as any)
        }
    } else if (pt.type === 'Feature') {
        for (const ring of extractOuterRings(pt)) holes.push(ring as any)
    }

    return {
        type: 'Feature',
        properties: { name: 'World mask with Portugal hole' },
        geometry: { type: 'Polygon', coordinates: [world, ...holes] },
    }
}

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

    const mask = useMemo(() => (pt ? buildPortugalMask(pt) : null), [pt])

    return (
        <MapContainer
            center={[39.5, -8]}
            zoom={6}
            scrollWheelZoom
            attributionControl
            preferCanvas
            style={{ height: '100vh', width: '100vw' }}
        >
            {/* Base leve */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {/* Detalhe (estradas/rios/cidades) — visível dentro do recorte */}
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
            />

            {/* Máscara para tapar o detalhe fora de Portugal */}
            {mask && (
                <GeoJSON
                    data={mask as any}
                    style={{ color: 'transparent', weight: 0, fillColor: '#ffffff', fillOpacity: 0.92 }}
                    interactive={false}
                />
            )}

            {/* Contorno real de Portugal */}
            {pt && (
                <GeoJSON
                    data={pt as any}
                    style={() => ({ color: '#2E7D32', weight: 2, fillOpacity: 0, smoothFactor: 2 })}
                    interactive={false}
                />
            )}

            {/* Distritos com contorno sempre visível e bold no hover */}
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