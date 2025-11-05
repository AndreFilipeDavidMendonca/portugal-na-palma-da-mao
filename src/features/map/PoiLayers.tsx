// src/features/map/PoiLayers.tsx
import { GeoJSON } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import { POI_COLORS, type PoiCategory } from "@/utils/constants";
import { POI_ICON_URL, DEFAULT_ICON_SIZE, DEFAULT_ICON_ANCHOR } from "@/utils/icons";

type AnyGeo = any;

/** Deduz a categoria a partir das tags OSM (ordem importa) */
export function getPoiCategory(f: any): PoiCategory | null {
    const p = f?.properties || {};

    // ===== PALACE (prioridade alta para não cair como "castle") =====
    if (p.historic === "palace") return "palace";
    if (p.building === "palace") return "palace";
    if (p.castle_type === "palace") return "palace";

    // ===== CASTLE =====
    if (p.historic === "castle") return "castle";
    if (p.building === "castle") return "castle";
    if (p.castle_type === "castle" || p.castle_type === "fortress") return "castle";

    // Ruínas de castelo
    if (p.historic === "ruins" && p.ruins === "castle") return "ruins";

    // ===== MONUMENT / RUINS (genéricas) =====
    if (p.historic === "monument") return "monument";
    if (p.historic === "ruins") return "ruins";

    // ===== CHURCH =====
    if (p.historic === "church") return "church";
    if (p.amenity === "place_of_worship") return "church";
    if (p.building === "church") return "church";

    // ===== VIEWPOINT =====
    if (p.tourism === "viewpoint") return "viewpoint";

    // ===== ÁREAS =====
    if (p.leisure === "park") return "park";
    if (p.boundary === "protected_area") return "protected_area";

    return null;
}

/** Filtra a FeatureCollection pelos tipos seleccionados */
export function filterFeaturesByTypes(geo: AnyGeo | null, selected: Set<PoiCategory>) {
    if (!geo) return null;
    if (!geo.features) return geo;

    const feats = geo.features.filter((f: any) => {
        const k = getPoiCategory(f);
        return k ? selected.has(k) : false;
    });

    return { type: "FeatureCollection", features: feats };
}

/** Camada de pontos culturais com ícones (fallback: círculo colorido) */
export function PoiPointsLayer({
                                   data,
                                   selectedTypes,
                               }: {
    data: AnyGeo;
    selectedTypes: Set<PoiCategory>;
}) {
    const key = Array.from(selectedTypes).sort().join(",");

    return (
        <GeoJSON
            key={key}
            data={data as any}
            filter={(f: any) => {
                const cat = getPoiCategory(f);
                return cat ? selectedTypes.has(cat) : false;
            }}
            pointToLayer={(feature: any, latlng: LatLngExpression) => {
                const cat = getPoiCategory(feature);

                if (cat && POI_ICON_URL[cat]) {
                    const icon = L.icon({
                        iconUrl: POI_ICON_URL[cat],
                        iconSize: DEFAULT_ICON_SIZE,
                        iconAnchor: DEFAULT_ICON_ANCHOR,
                    });
                    return L.marker(latlng, { icon });
                }

                const color = (cat && POI_COLORS[cat]) || "#455A64";
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
                const catLabel = cat ? cat : "";
                layer.bindTooltip(
                    `<strong>${name}</strong>${catLabel ? `<div>${catLabel}</div>` : ""}`,
                    { direction: "top", offset: L.point(0, -10), sticky: true }
                );
            }}
        />
    );
}

/** Áreas (parques, zonas protegidas) */
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