
import { GeoJSON, useMap } from 'react-leaflet'
import type { FeatureCollection } from 'geojson'

type Props = {
  data: FeatureCollection
  activeColor?: string
  activeWeight?: number
}

// Renders a GeoJSON that only shows a green outline on hover
export default function HoverOutline({ data, activeColor = '#2E7D32', activeWeight = 3 }: Props){
  const map = useMap()
  // Default invisible style (no stroke/fill)
  const baseStyle = { color: activeColor, weight: 0, fillOpacity: 0 }
  const overStyle = { color: activeColor, weight: activeWeight, fillOpacity: 0.05 }

  return (
    <GeoJSON
      data={data as any}
      style={() => baseStyle}
      eventHandlers={{
        mouseover: (e) => {
          const layer: any = e.propagatedFrom || e.layer || (e as any).target
          layer.setStyle(overStyle)
        },
        mouseout: (e) => {
          const layer: any = e.propagatedFrom || e.layer || (e as any).target
          layer.setStyle(baseStyle)
        }
      }}
    />
  )
}
