
import { MapContainer, TileLayer } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { loadGeo } from '@/lib/geo'
import GeoBoundary from '@/features/map/GeoBoundary'
import { useNavigate } from 'react-router-dom'

export default function Municipio(){
  const [conc, setConc] = useState<any>(null)
  const nav = useNavigate()
  useEffect(()=>{ loadGeo('/geo/concelho_lisboa.geojson').then(setConc) },[])
  return (
    <MapContainer center={[38.74,-9.15]} zoom={12} scrollWheelZoom attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 attribution="&copy; OpenStreetMap contributors"/>
      {conc && <GeoBoundary data={conc} fit onClick={()=>nav('/freguesia/alfama')} />}
    </MapContainer>
  )
}
