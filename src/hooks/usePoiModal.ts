import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPoiById, type PoiDto } from "@/lib/api";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

function pickPoiLabelFromDto(p: PoiDto): string {
  return (p.namePt ?? p.name ?? "").trim();
}

function poiDtoToFeature(p: PoiDto): any {
  const category = p.category ?? null;

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    properties: {
      ...p,
      id: p.id,
      poiId: p.id,
      namePt: p.namePt ?? p.name,
      tags: { category, subcategory: p.subcategory ?? null },
    },
  };
}

export function usePoiModal() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<PoiInfo | null>(null);
  const [feature, setFeature] = useState<any | null>(null);

  const [openingPoi, setOpeningPoi] = useState(false);
  const [openingPoiLabel, setOpeningPoiLabel] = useState<string | null>(null);

  const reqRef = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setInfo(null);
    setFeature(null);
    setOpeningPoi(false);
    setOpeningPoiLabel(null);
  }, []);

  const openFromDto = useCallback(async (poiDto: PoiDto) => {
    const reqId = ++reqRef.current;

    const label = pickPoiLabelFromDto(poiDto);
    setOpeningPoi(true);
    setOpeningPoiLabel(label || null);

    setOpen(false);
    setInfo(null);

    const nextFeature = poiDtoToFeature(poiDto);
    setFeature(nextFeature);

    if (!label) {
      if (reqId === reqRef.current) {
        setOpeningPoi(false);
        setOpeningPoiLabel(null);
      }
      return;
    }

    try {
      const base = await fetchPoiInfo({
        approx: { name: label, lat: poiDto.lat, lon: poiDto.lon },
        sourceFeature: nextFeature,
      });

      if (reqId !== reqRef.current) return;
      if (!base) return;

      const merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

      setInfo({
        ...base,
        image: merged[0] ?? base.image ?? null,
        images: merged,
      });

      setOpen(true);
    } catch (e) {
      if (reqId === reqRef.current) {
        console.error("[usePoiModal] Falha fetchPoiInfo:", e);
      }
    } finally {
      if (reqId === reqRef.current) {
        setOpeningPoi(false);
        setOpeningPoiLabel(null);
      }
    }
  }, []);

  const openById = useCallback(async (poiId: number, label?: string | null) => {
    const reqId = ++reqRef.current;

    setOpeningPoi(true);
    setOpeningPoiLabel(label ?? null);

    setOpen(false);
    setInfo(null);
    setFeature(null);

    try {
      const dto = await fetchPoiById(poiId);
      if (reqId !== reqRef.current) return;
      if (dto) await openFromDto(dto);
    } catch (err) {
      if (reqId === reqRef.current) {
        console.error("[usePoiModal] Falha ao abrir POI por id:", err);
      }
    } finally {
      if (reqId === reqRef.current) {
        setOpeningPoi(false);
        setOpeningPoiLabel(null);
      }
    }
  }, [openFromDto]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ poiId: number; label?: string }>;
      const poiId = ce?.detail?.poiId;
      const label = ce?.detail?.label ?? null;
      if (!poiId) return;
      void openById(poiId, label);
    };

    window.addEventListener("pt:open-poi", handler as EventListener);
    return () => window.removeEventListener("pt:open-poi", handler as EventListener);
  }, [openById]);

  return {
    poiModalOpen: open,
    poiInfo: info,
    poiFeature: feature,
    openingPoi,
    openingPoiLabel,
    openPoiById: openById,
    openPoiFromDto: openFromDto,
    closePoiModal: close,
  };
}