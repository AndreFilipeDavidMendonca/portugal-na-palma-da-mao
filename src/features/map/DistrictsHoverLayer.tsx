import { GeoJSON } from 'react-leaflet'
import type { Feature, FeatureCollection } from 'geojson'
import { useMemo } from 'react'

type Props = {
    data: FeatureCollection
    color?: string
    baseWeight?: number
    hoverWeight?: number
    onClickDistrict?: (name: string) => void
}

export default function DistrictsHoverLayer({
                                                data,
                                                color = '#2E7D32',       // verde ecológico
                                                baseWeight = 1.2,         // espessura normal dos limites
                                                hoverWeight = 3,          // espessura em hover
                                                onClickDistrict
                                            }: Props) {
    const baseStyle = useMemo(() => ({
        color,
        weight: baseWeight,
        opacity: 1,
        fillOpacity: 0,
        smoothFactor: 2,
    }), [color, baseWeight])

    const hoverStyle = useMemo(() => ({
        color,
        weight: hoverWeight,
        opacity: 1,
        fillOpacity: 0.05,
    }), [color, hoverWeight])

    return (
        <GeoJSON
            data={data as any}
            style={() => baseStyle}
            onEachFeature={(feature: Feature, layer: any) => {
                const props = (feature.properties as any) || {}
                const name =
                    props.name ||
                    props.NAME ||
                    props.NAME_1 ||
                    props.NL_NAME_1 ||
                    props.NAME_EN ||
                    ''

                if (name)
                    layer.bindTooltip(String(name), {
                        sticky: true,
                        direction: 'top',
                        className: 'district-tooltip',
                    })

                layer.on('mouseover', () => {
                    layer.setStyle(hoverStyle)
                    layer.bringToFront?.()
                    const el = layer.getElement?.() as HTMLElement | null
                    if (el) el.style.cursor = 'pointer'
                })
                layer.on('mouseout', () => {
                    layer.setStyle(baseStyle)
                    const el = layer.getElement?.() as HTMLElement | null
                    if (el) el.style.cursor = 'default'
                })
                if (onClickDistrict)
                    layer.on('click', () => onClickDistrict(String(name)))
            }}
        />
    )
}