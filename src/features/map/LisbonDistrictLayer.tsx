
import { Rectangle, Tooltip, Marker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'

const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25,41], iconAnchor:[12,41]
})

const LISBON_BOUNDS: L.LatLngBoundsExpression = [[38.66,-9.5],[39.15,-8.6]]

export function LisbonDistrictLayer({ mode='overview' }:{ mode?: 'overview'|'focused' }){
  const map = useMap()
  const nav = useNavigate()
  if(mode==='focused'){
    map.fitBounds(LISBON_BOUNDS, { padding: [20,20] })
  }
  const onClick = () => nav('/municipio/lisboa')
  return (<>
    <Rectangle bounds={LISBON_BOUNDS}
               pathOptions={{ color: '#2E7D32', weight: 3, fillOpacity: 0.06 }}
               eventHandlers={{ click: onClick }}>
      <Tooltip direction="center" permanent>Distrito de Lisboa (clicar)</Tooltip>
    </Rectangle>
    <Marker position={[38.713909, -9.133476]} icon={icon}>
      <Popup>
        <strong>Castelo de São Jorge</strong><br/>Lisboa — Património histórico.
      </Popup>
    </Marker>
  </>)
}
