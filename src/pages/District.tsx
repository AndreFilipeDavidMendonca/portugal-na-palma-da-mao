
import { MapContainer, TileLayer } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { loadGeo } from '@/lib/geo'
import GeoBoundary from '@/features/map/GeoBoundary'
import { LisbonDistrictLayer } from '@/features/map/LisbonDistrictLayer'

export default function District(){
  const [dist, setDist] = useState<any>(null)
  useEffect(()=>{ loadGeo('/geo/distrito_lisboa.geojson').then(setDist) },[])
  return (
    <MapContainer center={[38.86,-9.14]} zoom={9} scrollWheelZoom attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 attribution="&copy; OpenStreetMap contributors"/>
      {dist && <GeoBoundary data={dist} fit />}
      <LisbonDistrictLayer mode="focused"/>
    </MapContainer>
  )
}
