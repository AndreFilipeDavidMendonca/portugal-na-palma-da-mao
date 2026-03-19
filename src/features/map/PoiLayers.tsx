import React from "react";
import { GeoJSON, LayerGroup, useMap } from "react-leaflet";
import L, { LatLngBounds, LatLngExpression } from "leaflet";

import { type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { paintPoiIconSvg, buildPoiMarkerHtml } from "@/utils/poiSvg";

type AnyGeo = any;

const iconCache = new Map<string, L.DivIcon>();
const MAX_VISIBLE_LABELS = 10;
const MIN_ZOOM_LABELS = 12;

function getName(p: any) {
  const tags = p?.tags ?? {};
  return (
    p?.namePt ||
    p?.["name:pt"] ||
    tags?.["name:pt"] ||
    p?.name ||
    tags?.name ||
    p?.["name:en"] ||
    tags?.["name:en"] ||
    null
  );
}

export function getPoiCategory(f: any): PoiCategory | null {
  const p = f?.properties || {};
  const tags = p.tags ?? {};

  const rawCat: string | undefined =
    (typeof p.category === "string" && p.category) ||
    (typeof tags.category === "string" && tags.category) ||
    (typeof p.historic === "string" && p.historic) ||
    (typeof tags.historic === "string" && tags.historic) ||
    undefined;

  if (!rawCat) return null;

  switch (rawCat.toLowerCase()) {
    case "castle":
      return "castle";
    case "palace":
      return "palace";
    case "monument":
      return "monument";
    case "ruins":
    case "ruin":
      return "ruins";
    case "church":
    case "chapel":
    case "igreja":
      return "church";
    case "viewpoint":
    case "miradouro":
      return "viewpoint";
    case "park":
    case "garden":
    case "jardim":
      return "park";
    case "trail":
    case "trilho":
    case "hiking":
      return "trail";
    case "gastronomy":
    case "restaurant":
    case "food":
      return "gastronomy";
    case "crafts":
    case "artisan":
    case "artesanato":
      return "crafts";
    case "accommodation":
    case "hotel":
    case "hostel":
    case "lodging":
      return "accommodation";
    case "event":
    case "evento":
    case "events":
      return "event";
    default:
      return null;
  }
}

function getIconSizeForZoom(zoom: number): number {
  const Z0 = 7;
  const Z1 = 20;
  const P0 = 26;
  const P1 = 46;

  const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
  return Math.round(P0 + (P1 - P0) * t);
}

function getLabelFontSizeForZoom(zoom: number): number {
  const Z0 = 13;
  const Z1 = 18;
  const P0 = 11;
  const P1 = 15;

  const t = Math.max(0, Math.min(1, (zoom - Z0) / (Z1 - Z0)));
  return Math.round(P0 + (P1 - P0) * t);
}

function useMapViewState() {
  const map = useMap();

  const [viewState, setViewState] = React.useState(() => ({
    zoom: map.getZoom(),
    bounds: map.getBounds(),
    center: map.getCenter(),
  }));

  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const update = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setViewState({
          zoom: map.getZoom(),
          bounds: map.getBounds(),
          center: map.getCenter(),
        });
      }, 80);
    };

    map.on("zoomend", update);
    map.on("moveend", update);

    return () => {
      map.off("zoomend", update);
      map.off("moveend", update);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [map]);

  return viewState;
}

function getCachedIcon(
  key: string,
  html: string,
  size: number,
  anchor?: [number, number]
) {
  const cacheKey = `${key}|${size}|${anchor?.join(",") ?? "default"}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const icon = L.divIcon({
    html,
    className: "poi-divicon",
    iconSize: [size, size],
    iconAnchor: anchor ?? [size / 2, size],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

function createPoiIcon(category: PoiCategory, sizePx: number) {
  const color = CATEGORY_COLORS[category] || "#64748b";
  const rawSvg = POI_ICON_SVG_RAW[category] ?? null;
  const iconSvg = rawSvg ? paintPoiIconSvg(rawSvg, color) : null;
  const html = buildPoiMarkerHtml(iconSvg, color, sizePx);

  return getCachedIcon(`poi-marker:${category}:${color}:v5`, html, sizePx);
}

function splitLabelTwoLines(name: string) {
  const MAX_LINE = 26;

  if (name.length <= MAX_LINE) return name;

  const words = name.split(" ");
  let line1 = "";
  let line2 = "";

  for (const word of words) {
    const nextLine1 = `${line1} ${word}`.trim();

    if (nextLine1.length <= MAX_LINE && !line2) {
      line1 = nextLine1;
    } else {
      line2 = `${line2} ${word}`.trim();
    }
  }

  if (!line2) return name;

  if (line2.length > MAX_LINE) {
    line2 = `${line2.slice(0, MAX_LINE - 1)}…`;
  }

  return `${line1}<br/>${line2}`;
}

function createPoiLabelIcon(category: PoiCategory, name: string, fontSize: number) {
  const color = CATEGORY_COLORS[category] || "#d7b25a";
  const formattedName = splitLabelTwoLines(name);
  const safeTitle = name.replace(/"/g, "&quot;");

  const plainLength = name.length;
  const width = Math.max(90, Math.min(plainLength * fontSize * 0.58, 220));
  const height = Math.round(fontSize * 2.35);

  const html = `
    <div
      class="poi-inline-label"
      style="
        color:${color};
        font-size:${fontSize}px;
      "
      title="${safeTitle}"
    >
      ${formattedName}
    </div>
  `;

  return getCachedIcon(
    `poi-label:${category}:${color}:${name}:${fontSize}`,
    html,
    width,
    [-14, Math.round(height * 1.0)]
  );
}

function isPointFeature(f: any) {
  return f?.geometry?.type === "Point" && Array.isArray(f?.geometry?.coordinates);
}

function getVisibleLabelFeatures(
  data: AnyGeo,
  bounds: LatLngBounds,
  center: L.LatLng
) {
  const features = (data?.features ?? []) as any[];

  return features
    .filter((f) => {
      if (!isPointFeature(f)) return false;

      const [lon, lat] = f.geometry.coordinates;
      if (typeof lat !== "number" || typeof lon !== "number") return false;

      return bounds.contains(L.latLng(lat, lon));
    })
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      const latlng = L.latLng(lat, lon);

      return {
        feature: f,
        distance: center.distanceTo(latlng),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_VISIBLE_LABELS)
    .map((item) => item.feature);
}

export function PoiPointsLayer({
  data,
  selectedTypes,
  nonce = 0,
  onSelect,
}: {
  data: AnyGeo;
  selectedTypes: ReadonlySet<PoiCategory>;
  nonce?: number;
  onSelect?: (feature: any) => void;
}) {
  const { zoom, bounds, center } = useMapViewState();

  const showLabels = zoom >= MIN_ZOOM_LABELS;
  const iconSize = getIconSizeForZoom(zoom);
  const labelFontSize = getLabelFontSizeForZoom(zoom);

  const labelData = React.useMemo(() => {
    if (!showLabels) {
      return { type: "FeatureCollection", features: [] as any[] };
    }

    return {
      type: "FeatureCollection",
      features: getVisibleLabelFeatures(data, bounds, center),
    };
  }, [
    data,
    showLabels,
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
    center.lat,
    center.lng,
  ]);

  const baseKey = React.useMemo(() => {
    const cats = Array.from(selectedTypes ?? []).sort().join(",");
    const ids = (data?.features ?? []).map((f: any) => f?.properties?.id ?? "").join(",");
    return `${cats}|n:${nonce}|ids:${ids}`;
  }, [selectedTypes, nonce, data]);

  const labelsKey = React.useMemo(() => {
    return `labels:${zoom}:${bounds.toBBoxString()}:${center.lat.toFixed(4)}:${center.lng.toFixed(4)}`;
  }, [zoom, bounds, center]);

  return (
    <LayerGroup key={baseKey}>
      <GeoJSON
        data={data as any}
        pointToLayer={(feature: any, latlng: LatLngExpression) => {
          const category = getPoiCategory(feature);

          if (category) {
            const icon = createPoiIcon(category, iconSize);
            const marker = L.marker(latlng, { icon });

            if (onSelect) {
              marker.on("click", () => onSelect(feature));
            }

            return marker;
          }

          const fallback = L.circleMarker(latlng, {
            radius: 2,
            weight: 0.6,
            color: "#555",
            fillColor: "#555",
            fillOpacity: 0.7,
          } as L.CircleMarkerOptions);

          if (onSelect) {
            fallback.on("click", () => onSelect(feature));
          }

          return fallback;
        }}
        onEachFeature={(_feature: any, layer: L.Layer) => {
          const anyLayer: any = layer;
          if (anyLayer._icon) anyLayer._icon.style.cursor = "pointer";
          if (anyLayer._path) anyLayer._path.style.cursor = "pointer";
        }}
      />

      {showLabels && (
        <GeoJSON
          key={labelsKey}
          data={labelData as any}
          pointToLayer={(feature: any, latlng: LatLngExpression) => {
            const props = feature?.properties || {};
            const category = getPoiCategory(feature);
            const name = getName(props);

            if (!category || !name) {
              return L.circleMarker(latlng, {
                opacity: 0,
                fillOpacity: 0,
                radius: 0,
              });
            }

            const icon = createPoiLabelIcon(category, name, labelFontSize);

            return L.marker(latlng, {
              icon,
              interactive: false,
              keyboard: false,
              zIndexOffset: -1000,
            });
          }}
        />
      )}
    </LayerGroup>
  );
}

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