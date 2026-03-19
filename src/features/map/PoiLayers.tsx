import React from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";

import { POI_LABELS, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { paintPoiIconSvg, buildPoiMarkerHtml } from "@/utils/poiSvg";

type AnyGeo = any;

const iconCache = new Map<string, L.DivIcon>();

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

function useMapZoom() {
  const map = useMap();
  const [zoom, setZoom] = React.useState<number>(() => map.getZoom());

  React.useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);

    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  return zoom;
}

function getCachedIcon(key: string, html: string, size: number) {
  const cacheKey = `${key}|${size}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const icon = L.divIcon({
    html,
    className: "poi-divicon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

function createPoiIcon(category: PoiCategory, sizePx: number) {
  const color = CATEGORY_COLORS[category] || "#64748b";
  const rawSvg = POI_ICON_SVG_RAW[category] ?? null;
  const iconSvg = rawSvg ? paintPoiIconSvg(rawSvg, color) : null;
  const html = buildPoiMarkerHtml(iconSvg, color, sizePx);

  return getCachedIcon(`poi-marker:${category}:${color}:v3`, html, sizePx);
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
  const map = useMap();
  const zoom = useMapZoom();

  const MIN_ZOOM_TOOLTIPS = 13;
  const MAX_OPEN = 1;
  const showTooltips = zoom >= MIN_ZOOM_TOOLTIPS;

  const showTooltipsRef = React.useRef(showTooltips);
  React.useEffect(() => {
    showTooltipsRef.current = showTooltips;
  }, [showTooltips]);

  const iconSize = getIconSizeForZoom(zoom);

  const key = React.useMemo(() => {
    const cats = Array.from(selectedTypes ?? []).sort().join(",");
    const ids = (data?.features ?? []).map((f: any) => f?.properties?.id ?? "").join(",");
    return `${cats}|n:${nonce}|ids:${ids}`;
  }, [selectedTypes, nonce, data]);

  const geoRef = React.useRef<L.GeoJSON | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const getCurrentLayers = React.useCallback((): L.Layer[] => {
    const geo = geoRef.current as any;
    return geo?.getLayers?.() ?? [];
  }, []);

  const updateVisibleTooltips = React.useCallback(() => {
    const layers = getCurrentLayers();

    if (!showTooltipsRef.current) {
      for (const layer of layers) {
        (layer as any)?.closeTooltip?.();
      }
      return;
    }

    const bounds = map.getBounds();
    const center = bounds.getCenter();
    const candidates: { layer: any; dist: number }[] = [];

    for (const layer of layers) {
      const marker: any = layer;
      const latlng = marker?.getLatLng?.();
      if (!latlng) continue;

      if (!bounds.contains(latlng)) {
        marker.closeTooltip?.();
        continue;
      }

      candidates.push({
        layer: marker,
        dist: center.distanceTo(latlng),
      });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const keep = new Set(candidates.slice(0, MAX_OPEN).map((c) => c.layer));

    for (const layer of layers) {
      const marker: any = layer;
      if (!marker?.getLatLng?.()) continue;

      if (keep.has(marker)) marker.openTooltip?.();
      else marker.closeTooltip?.();
    }
  }, [map, getCurrentLayers]);

  const scheduleUpdate = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateVisibleTooltips);
  }, [updateVisibleTooltips]);

  React.useEffect(() => {
    const handler = () => scheduleUpdate();

    map.on("zoomend", handler);
    map.on("moveend", handler);

    const t1 = window.setTimeout(() => scheduleUpdate(), 0);
    const t2 = window.setTimeout(() => scheduleUpdate(), 80);

    return () => {
      map.off("zoomend", handler);
      map.off("moveend", handler);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [map, scheduleUpdate, key]);

  return (
    <GeoJSON
      key={key}
      data={data as any}
      ref={(ref) => {
        geoRef.current = (ref as any) ?? null;
      }}
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
      onEachFeature={(feature: any, layer: L.Layer) => {
        const props = feature?.properties || {};
        const name = getName(props) || "Sem nome";
        const category = getPoiCategory(feature);
        const label = category ? POI_LABELS[category] : "";

        const tooltipHtml = `<strong>${name}</strong>${label ? `<div>${label}</div>` : ""}`;

        layer.bindTooltip(tooltipHtml, {
          className: "poi-tooltip",
          direction: "top",
          offset: L.point(0, -10),
          sticky: false,
          opacity: 1,
          permanent: false,
          interactive: false,
        });

        const anyLayer: any = layer;
        if (anyLayer._icon) anyLayer._icon.style.cursor = "pointer";
        if (anyLayer._path) anyLayer._path.style.cursor = "pointer";

        scheduleUpdate();
        anyLayer.once?.("add", () => scheduleUpdate());
      }}
    />
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