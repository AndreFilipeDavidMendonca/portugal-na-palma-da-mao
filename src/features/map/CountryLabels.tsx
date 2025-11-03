import { useEffect, useState } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'

type Props = { url?: string }

const labelIcon = (name: string) =>
    L.divIcon({
        className: 'country-label',
        html: `<span>${name}</span>`,
        iconSize: [0, 0],
    })

export default function CountryLabels({ url = '/geo/country_labels.geojson' }: Props) {
    const [fc, setFc] = useState<FeatureCollection | null>(null)

    useEffect(() => {
        fetch(url).then(r => r.json()).then(setFc).catch(() => setFc(null))
    }, [url])

    if (!fc) return null

    return (
        <>
            {fc.features.map((f: Feature, i: number) => {
                const p = f.properties as any
                const name = p?.NAME || p?.NAME_EN || p?.ADM0_A3 || ''
                const [x, y] = (f.geometry as any).coordinates || []
                // Leaflet usa [lat, lng] ⇒ [y, x]
                return (
                    <Marker
                        key={i}
                        position={[y, x]}
                        icon={labelIcon(name)}
                        interactive={false}
                        pane="overlayPane" // acima da máscara
                    >
                        {/* Opcional: tooltip on hover */}
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.8}>{name}</Tooltip>
                    </Marker>
                )
            })}
        </>
    )
}