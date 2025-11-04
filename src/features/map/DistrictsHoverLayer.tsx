import { GeoJSON } from "react-leaflet"
import { useMemo } from "react"

type Props = {
  data: any
  onClickDistrict?: (name: string, feature: any) => void
  baseWeight?: number
  hoverWeight?: number
}

export default function DistrictsHoverLayer({
  data,
  onClickDistrict,
  baseWeight = 1.2,
  hoverWeight = 3
}: Props) {

  const style = useMemo(
    () => ({
      color: "#2E7D32",
      weight: baseWeight,
      fillOpacity: 0,
      smoothFactor: 1.5
    }),
    [baseWeight]
  )

  return (
    <GeoJSON
      data={data}
      style={() => style}
      onEachFeature={(feature, layer) => {
        const name =
          (feature.properties?.NAME_1 ||
           feature.properties?.name ||
           feature.properties?.gn_name) ?? "Distrito"

      layer.on({
          click: () => {
              const name = feature?.properties?.name || feature?.properties?.NAME_1 || "";
              onClickDistrict?.(name, feature); // <- segundo argumento é o feature
          }
      });
        layer.on("mouseover", () => (layer as any).setStyle({ weight: hoverWeight }))
        layer.on("mouseout",  () => (layer as any).setStyle({ weight: baseWeight }))
        layer.bindTooltip(name, { sticky: true })
        layer.on("click", () => onClickDistrict?.(name, feature))
      }}
    />
  )
}
