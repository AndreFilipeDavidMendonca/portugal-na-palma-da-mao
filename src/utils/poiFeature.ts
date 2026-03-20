import type { PoiDto, PoiLiteDto } from "@/lib/api";
import { uniqStrings } from "@/utils/collections";

export function pickPoiId(feature: any): number | null {
  const id = feature?.properties?.id;

  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string") {
    const parsed = Number(id.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function pickOwnerId(feature: any): string | null {
  const value = feature?.properties?.ownerId ?? feature?.properties?.owner_id ?? null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function pickPoiLabelFromDto(poi: PoiDto): string {
  return (poi.namePt ?? poi.name ?? "").trim();
}

export function poiDtoToFeature(poi: PoiDto): any {
  const category = poi.category ?? null;

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [poi.lon, poi.lat] },
    properties: {
      ...poi,
      id: poi.id,
      poiId: poi.id,
      namePt: poi.namePt ?? poi.name,
      tags: { category, subcategory: poi.subcategory ?? null },
    },
  };
}


export function poiLiteDtoToFeature(poi: PoiLiteDto): any {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [poi.lon, poi.lat] },
    properties: {
      id: poi.id,
      poiId: poi.id,
      districtId: poi.districtId ?? null,
      ownerId: poi.ownerId ?? null,
      name: poi.name,
      namePt: poi.namePt ?? poi.name,
      category: poi.category ?? null,
      tags: { category: poi.category ?? null, subcategory: null },
    },
  };
}

export function mergePoiMedia(image?: string | null, images?: string[] | null, limit = 5): string[] {
  return uniqStrings([image ?? "", ...(images ?? [])]).slice(0, limit);
}

export function sanitizePersistableMedia(list: string[]): string[] {
  return (list ?? []).filter((item) => {
    if (!item) return false;
    if (item.startsWith("data:")) return true;
    return item.startsWith("http://") || item.startsWith("https://");
  });
}
