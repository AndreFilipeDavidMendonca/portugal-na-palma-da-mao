
import { GeoJSON, useMap } from 'react-leaflet'
import type { FeatureCollection, Geometry } from 'geojson'
import L from 'leaflet'

type Props = {
  data: FeatureCollection
  color?: string
  fillColor?: string
  onClick?: () => void
  fit?: boolean
}

export default function GeoBoundary({ data, color='#2E7D32', fillColor='#cde8d1', onClick, fit=false }: Props){
  const map = useMap()
  const gjRef: any = (el: any) => {
    if(el && fit){
      // Fit bounds to the GeoJSON layer
      const layer = el as any
      const b = layer.getBounds?.() || (layer as any).feature?.geometry?.coordinates
      if(layer.getBounds){
        map.fitBounds(layer.getBounds(), { padding:[20,20] })
      }
    }
  }

  return (
    <GeoJSON
      ref={gjRef}
      data={data as any}
      style={() => ({ color, weight: 2, fillColor, fillOpacity: 0.2 })}
      eventHandlers={ onClick ? { click: () => onClick() } : undefined }
    />
  )
}
