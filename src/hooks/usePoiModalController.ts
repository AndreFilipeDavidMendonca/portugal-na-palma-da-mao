import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import { uniqStrings } from "@/utils/poiGeo";

type PoiCacheEntry = {
  info: PoiInfo;
  updatedAt: number;
};

function pickPoiId(feature: any): number | null {
  const id = feature?.properties?.id;

  if (typeof id === "number" && Number.isFinite(id)) return id;

  if (typeof id === "string") {
    const n = Number(id.trim());
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function pickPoiLabel(feature: any): string | null {
  const p = feature?.properties ?? {};
  const label = p.namePt ?? p["name:pt"] ?? p.name ?? p["name:en"] ?? p.label ?? null;
  return typeof label === "string" && label.trim().length >= 3 ? label.trim() : null;
}

export function usePoiModalController() {
  const [selectedPoi, setSelectedPoi] = useState<any | null>(null);
  const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
  const [showPoiModal, setShowPoiModal] = useState(false);
  const [loadingPoi, setLoadingPoi] = useState(false);

  const reqRef = useRef(0);
  const poiCacheRef = useRef<Map<number, PoiCacheEntry>>(new Map());
  const poiInflightRef = useRef<Map<number, Promise<PoiInfo | null>>>(new Map());

  const closePoiModal = useCallback(() => {
    setShowPoiModal(false);
    setSelectedPoi(null);
    setPoiInfo(null);
    setLoadingPoi(false);
  }, []);

  const openWithInfo = useCallback((info: PoiInfo) => {
    setPoiInfo(info);
    setShowPoiModal(true);
    setLoadingPoi(false);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedPoi?.properties) return;

      const reqId = ++reqRef.current;

      setShowPoiModal(false);
      setPoiInfo(null);
      setLoadingPoi(true);

      const poiId = pickPoiId(selectedPoi);
      const label = pickPoiLabel(selectedPoi);

      if (!label) {
        if (alive && reqRef.current === reqId) setLoadingPoi(false);
        return;
      }

      if (poiId != null) {
        const cached = poiCacheRef.current.get(poiId);
        if (cached) {
          if (!alive || reqRef.current !== reqId) return;
          openWithInfo(cached.info);
          return;
        }

        const inflight = poiInflightRef.current.get(poiId);
        if (inflight) {
          const info = await inflight;
          if (!alive || reqRef.current !== reqId) return;

          if (info) openWithInfo(info);
          else setLoadingPoi(false);

          return;
        }
      }

      const task = (async (): Promise<PoiInfo | null> => {
        const approxLat = selectedPoi.geometry?.coordinates?.[1];
        const approxLon = selectedPoi.geometry?.coordinates?.[0];

        const base = await fetchPoiInfo({
          approx: {
            name: label,
            lat: typeof approxLat === "number" ? approxLat : null,
            lon: typeof approxLon === "number" ? approxLon : null,
          },
          sourceFeature: selectedPoi,
        });

        if (!base) return null;

        const merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

        const infoNow: PoiInfo = {
          ...base,
          image: merged[0] ?? base.image ?? null,
          images: merged,
        };

        if (poiId != null) {
          poiCacheRef.current.set(poiId, {
            info: infoNow,
            updatedAt: Date.now(),
          });
        }

        return infoNow;
      })();

      if (poiId != null) {
        poiInflightRef.current.set(poiId, task);
      }

      try {
        const info = await task;
        if (!alive || reqRef.current !== reqId) return;

        if (info) openWithInfo(info);
        else setLoadingPoi(false);
      } catch (e) {
        if (!alive || reqRef.current !== reqId) return;
        console.error("[usePoiModalController] Falha ao abrir POI:", e);
        setLoadingPoi(false);
      } finally {
        if (poiId != null) {
          poiInflightRef.current.delete(poiId);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedPoi, openWithInfo]);

  return {
    selectedPoi,
    setSelectedPoi,
    poiInfo,
    showPoiModal,
    loadingPoi,
    closePoiModal,
  };
}