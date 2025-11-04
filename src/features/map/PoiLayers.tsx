import { GeoJSON } from "react-leaflet"
import L from "leaflet"

export function PoiPointsLayer({ data }: { data: any }) {
  const icon = (color = "#3B82F6") =>
    L.divIcon({
      className: "poi-pin",
      html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};
             box-shadow:0 0 0 2px #fff"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })

  return (
    <GeoJSON
      data={data}
      pointToLayer={(f, latlng) => {
        const c =
          f.properties?.historic ? "#9333EA" :
          f.properties?.tourism  ? "#3B82F6" : "#16A34A"
        return L.marker(latlng, { icon: icon(c) })
      }}
      onEachFeature={(f, layer) => {
        const name =
          f.properties?.name || f.properties?.["name:pt"] || f.properties?.["name:en"] || "Ponto"
        const cat =
          f.properties?.historic || f.properties?.tourism || f.properties?.natural || ""
        layer.bindPopup(`<strong>${name}</strong><div style="opacity:.7">${cat}</div>`)
      }}
    />
  )
}

export function PoiAreasLayer({ data }: { data: any }) {
  return (
    <GeoJSON
      data={data}
      style={() => ({
        color: "#1B5E20",
        weight: 1.2,
        fillOpacity: 0.08
      })}
    />
  )
}
