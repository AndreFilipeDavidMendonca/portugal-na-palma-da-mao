export const uniqStrings = (arr: string[]) =>
  Array.from(new Set((arr ?? []).filter(Boolean)));

export const mergeMedia = (base: string[], extra: string[], limit = 5) =>
  uniqStrings([...(base ?? []), ...(extra ?? [])]).slice(0, limit);

export function pickPoiLabel(feature: any): string | null {
  const p = feature?.properties ?? {};
  const label = p.namePt ?? p["name:pt"] ?? p.name ?? p["name:en"] ?? p.label ?? null;
  return typeof label === "string" && label.trim().length >= 3 ? label.trim() : null;
}

export function pickPoiId(feature: any): number | null {
  const id = feature?.properties?.id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

export function pickOwnerId(feature: any): string | null {
  const v = feature?.properties?.ownerId ?? feature?.properties?.owner_id ?? null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function isBusinessPoi(feature: any): boolean {
  const p = feature?.properties ?? {};
  const src = String(p.source ?? "").trim().toLowerCase();
  const cat = String(p.category ?? "").trim().toLowerCase();

  return (
    src === "business" ||
    src === "commercial" ||
    src === "comercial" ||
    cat === "business" ||
    cat === "commercial" ||
    cat === "comercial"
  );
}