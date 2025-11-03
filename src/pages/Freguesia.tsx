
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { loadGeo } from '@/lib/geo'
import GeoBoundary from '@/features/map/GeoBoundary'
import L from 'leaflet'

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41]
})

export default function Freguesia(){
  const [freg, setFreg] = useState<any>(null)
  useEffect(()=>{ loadGeo('/geo/freguesia_alfama.geojson').then(setFreg) },[])
  return (
    <MapContainer center={[38.713,-9.133]} zoom={15} scrollWheelZoom attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                 attribution="&copy; OpenStreetMap contributors"/>
      {freg && <GeoBoundary data={freg} fit />}
      <Marker position={[38.713909, -9.133476]} icon={icon}>
        <Popup>
          <div style={{maxWidth:260}}>
            <strong>Castelo de São Jorge</strong><br/>
            <em>Alfama, Lisboa</em><br/>
            <p style={{margin:'6px 0'}}>Fortificação histórica no topo da colina mais alta do centro histórico de Lisboa, com vistas amplas sobre a cidade e o Tejo.</p>
            <img src="/images/castelo-sao-jorge.svg" alt="Castelo de São Jorge" style={{width:'100%',borderRadius:6}}/>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
