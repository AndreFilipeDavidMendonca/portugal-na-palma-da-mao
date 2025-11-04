// src/features/map/PoiLayers.tsx
import { GeoJSON } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import { POI_COLORS, type PoiCategory, CULTURAL_NODE_TAGS } from "@/utils/constants";

type AnyGeo = any;

function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};
    // historic
    const h = p.historic as string | undefined;
    if (h && ([
        "castle","monument","memorial","ruins","church"
    ] as PoiCategory[]).includes(h as PoiCategory)) return h as PoiCategory;

    // tourism
    const t = p.tourism as string | undefined;
    if (t && ([
        "museum","artwork","viewpoint","attraction"
    ] as PoiCategory[]).includes(t as PoiCategory)) return t as PoiCategory;

    // áreas (caso uses este componente para áreas em vez do de áreas)
    const leisure = p.leisure as string | undefined;
    if (leisure === "park") return "park";
    const boundary = p.boundary as string | undefined;
    if (boundary === "protected_area") return "protected_area";

    return null;
}

export function filterFeaturesByTypes(geo: AnyGeo | null, selected: Set<PoiCategory>) {
    if (!geo) return null;
    if (!geo.features) return geo;

    const feats = geo.features.filter((f: any) => {
        const k = getPoiCategory(f);
        return k ? selected.has(k) : false;
    });

    return { type: "FeatureCollection", features: feats };
}

export function PoiPointsLayer({
                                   data,
                                   selectedTypes
                               }: {
    data: AnyGeo;
    selectedTypes: Set<PoiCategory>;
}) {
    // força re-montagem quando filtros mudam (para re-aplicar filter/estilo)
    const key = Array.from(selectedTypes).sort().join(",");

    return (
        <GeoJSON
            key={key}
            data={data as any}
            // inclui só se a categoria estiver selecionada
            filter={(f: any) => {
                const cat = getPoiCategory(f);
                return cat ? selectedTypes.has(cat) : false;
            }}
            pointToLayer={(feature: any, latlng: LatLngExpression) => {
                const cat = getPoiCategory(feature);
                const color = (cat && POI_COLORS[cat]) || "#D32F2F";
                return L.circleMarker(latlng, {
                    radius: 6,
                    weight: 1.25,
                    color,
                    fillColor: color,
                    fillOpacity: 0.9,
                });
            }}
            onEachFeature={(feature, layer) => {
                const p = (feature as any).properties || {};
                const name = p["name:pt"] || p.name || "Sem nome";
                const cat = getPoiCategory(feature);
                const label = cat ? cat : "";
                layer.bindTooltip(`<strong>${name}</strong>${label ? `<div>${label}</div>` : ""}`);
            }}
        />
    );
}

// (se já usas um layer próprio para áreas, mantém como estava)
export function PoiAreasLayer({ data }: { data: AnyGeo }) {
    return (
        <GeoJSON
            data={data as any}
            style={() => ({
                color: "#2E7D32",
                weight: 1,
                fillColor: "#A5D6A7",
                fillOpacity: 0.25,
            })}
        />
    );
}