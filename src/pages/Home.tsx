import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { useAuth } from "@/auth/AuthContext";
import { loadGeo } from "@/lib/geo";
import { fetchDistricts, fetchPoiById, type PoiDto, type SearchItem } from "@/lib/api";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";

import { WORLD_BASE, WORLD_LABELS } from "@/utils/constants";
import { CONTINENTAL_PT_BOUNDS, WORLD_BOUNDS } from "@/constants/map";
import useMediaQuery from "@/hooks/useMediaQuery";
import { pickPoiLabelFromDto, poiDtoToFeature, mergePoiMedia } from "@/utils/poiFeature";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";

import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";

import DistrictModal from "@/pages/district/DistrictModal";
import PoiModal from "@/pages/poi/PoiModal";
import LoginModal from "@/pages/auth/LoginModal";
import ProfileModal from "@/pages/auth/ProfileModal";
import CreatePoiModal from "@/pages/poi/CreatePoiModal/CreatePoiModal";

import { useCreatePoiModal } from "@/hooks/useCreatePoiModal";

type AnyGeo = any;
type ProfileModalMode = "create" | "edit";

function normalizeDistrictKey(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*distrito\s+de\s+/i, "")
    .trim()
    .toLowerCase();
}

export default function Home() {
  const { user } = useAuth();
  const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin", [user?.role]);

  const isMobile = useMediaQuery("(max-width: 900px)");
  const mapRef = useRef<L.Map | null>(null);
  const homePoiReqRef = useRef(0);

  const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
  const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

  const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(null);
  const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);

  const [homePoiOpen, setHomePoiOpen] = useState(false);
  const [homePoiInfo, setHomePoiInfo] = useState<PoiInfo | null>(null);
  const [homePoiFeature, setHomePoiFeature] = useState<any | null>(null);

  const [openingPoi, setOpeningPoi] = useState(false);
  const [openingPoiLabel, setOpeningPoiLabel] = useState<string | null>(null);

  const [openingDistrict, setOpeningDistrict] = useState(false);
  const [openingDistrictLabel, setOpeningDistrictLabel] = useState<string | null>(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalMode, setProfileModalMode] = useState<ProfileModalMode>("edit");

  const { showCreatePoiModal, closeCreatePoi } = useCreatePoiModal();

  const initialCenter = useMemo<[number, number]>(() => {
    return isMobile ? [37.5, -8.0] : [37.0, -15.0];
  }, [isMobile]);

  const fitContinentalPT = useCallback((map: L.Map, animate = false) => {
    const topbar = document.querySelector<HTMLElement>(".top-district-filter");
    const topH = topbar?.offsetHeight ?? 0;

    map.fitBounds(CONTINENTAL_PT_BOUNDS, {
      animate,
      paddingTopLeft: [10, topH + 50],
      paddingBottomRight: [10, 10],
      maxZoom: 10,
    });

    setTimeout(() => map.invalidateSize(), 0);
  }, []);

  const fitGeoJSONBoundsTight = useCallback((map: L.Map, geo: any, animate = true) => {
    if (!map || !geo) return;

    try {
      const bounds = L.geoJSON(geo).getBounds();
      if (!bounds.isValid()) return;

      const topbar = document.querySelector<HTMLElement>(".top-district-filter");
      const topH = topbar?.offsetHeight ?? 0;

      map.fitBounds(bounds, {
        animate,
        paddingTopLeft: [10, topH + 50],
        paddingBottomRight: [10, 10],
        maxZoom: 6,
      });

      map.setMaxBounds(bounds.pad(0.22));
      setTimeout(() => map.invalidateSize(), 0);
    } catch (err) {
      console.error("[Home] fitGeoJSONBoundsTight:", err);
    }
  }, []);

  const zoomToFeatureBounds = useCallback((feature: any) => {
    const map = mapRef.current;
    if (!map || !feature) return;

    const bounds = L.geoJSON(feature).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08), { animate: true });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [ptData, distData] = await Promise.all([
          loadGeo("/geo/portugal.geojson"),
          loadGeo("/geo/distritos.geojson").catch(() => null),
        ]);

        if (cancelled) return;

        setPtGeo(ptData);

        if (!distData) {
          setDistrictsGeo(null);
          return;
        }

        const apiDistricts = await fetchDistricts();
        if (cancelled) return;

        const idByKey = new Map<string, number>();

        for (const district of apiDistricts ?? []) {
          if (district.name) idByKey.set(normalizeDistrictKey(district.name), district.id);
          if (district.namePt) idByKey.set(normalizeDistrictKey(district.namePt), district.id);
          if (district.code) idByKey.set(normalizeDistrictKey(district.code), district.id);
        }

        const patched = {
          ...distData,
          features: (distData.features ?? []).map((feature: any) => {
            const props = feature?.properties ?? {};
            const name = props.name || props.NAME || props["name:pt"] || "";
            const code = props.code || props.COD || props.DICOFRE || "";

            const districtDbId =
              idByKey.get(normalizeDistrictKey(code)) ??
              idByKey.get(normalizeDistrictKey(name)) ??
              null;

            return {
              ...feature,
              properties: {
                ...props,
                districtDbId,
                geoId: props.id ?? null,
              },
            };
          }),
        };

        setDistrictsGeo(patched);
      } catch (err) {
        console.error("[Home] geo bootstrap:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => {
      setShowProfileModal(false);
      setShowLoginModal(true);
    };

    const handleOpenProfile = () => {
      setShowLoginModal(false);
      setProfileModalMode("edit");
      setShowProfileModal(true);
    };

    const handleOpenRegister = () => {
      setShowLoginModal(false);
      setProfileModalMode("create");
      setShowProfileModal(true);
    };

    window.addEventListener("pt:open-login", handleOpenLogin);
    window.addEventListener("pt:open-profile", handleOpenProfile);
    window.addEventListener("pt:open-register", handleOpenRegister);

    return () => {
      window.removeEventListener("pt:open-login", handleOpenLogin);
      window.removeEventListener("pt:open-profile", handleOpenProfile);
      window.removeEventListener("pt:open-register", handleOpenRegister);
    };
  }, []);

  const featureByName = useMemo(() => {
    const map = new Map<string, any>();

    for (const feature of districtsGeo?.features ?? []) {
      const name =
        feature?.properties?.name ||
        feature?.properties?.NAME ||
        feature?.properties?.["name:pt"];

      if (name) {
        map.set(normalizeDistrictKey(name), feature);
      }
    }

    return map;
  }, [districtsGeo]);

  const districtFeatureById = useMemo(() => {
    const map = new Map<number, any>();

    for (const feature of districtsGeo?.features ?? []) {
      const id = feature?.properties?.districtDbId;
      if (typeof id === "number" && Number.isFinite(id)) {
        map.set(id, feature);
      }
    }

    return map;
  }, [districtsGeo]);

  const openDistrictModal = useCallback((feature: any) => {
    const label =
      feature?.properties?.name ||
      feature?.properties?.NAME ||
      feature?.properties?.["name:pt"] ||
      "Distrito";

    setOpeningDistrict(true);
    setOpeningDistrictLabel(label);
    setActiveDistrictFeature(feature);
    setIsDistrictModalOpen(true);
  }, []);

  const closeDistrictModal = useCallback(() => {
    setIsDistrictModalOpen(false);
    setActiveDistrictFeature(null);
    setOpeningDistrict(false);
    setOpeningDistrictLabel(null);

    const map = mapRef.current;
    if (!map) return;

    if (isMobile) fitContinentalPT(map, true);
    else if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, true);
  }, [fitContinentalPT, fitGeoJSONBoundsTight, isMobile, ptGeo]);

  const openPoiFromDto = useCallback(async (poiDto: PoiDto) => {
    const reqId = ++homePoiReqRef.current;
    const label = pickPoiLabelFromDto(poiDto);

    setOpeningPoi(true);
    setOpeningPoiLabel(label || null);
    setHomePoiOpen(false);
    setHomePoiInfo(null);

    const feature = poiDtoToFeature(poiDto);
    setHomePoiFeature(feature);

    if (!label) {
      if (reqId === homePoiReqRef.current) {
        setOpeningPoi(false);
        setOpeningPoiLabel(null);
      }
      return;
    }

    try {
      const base = await fetchPoiInfo({
        approx: { name: label, lat: poiDto.lat, lon: poiDto.lon },
        sourceFeature: feature,
      });

      if (reqId !== homePoiReqRef.current || !base) return;

      const media = mergePoiMedia(base.image, base.images, 10);

      setHomePoiInfo({
        ...base,
        image: media[0] ?? base.image ?? null,
        images: media,
      });

      setHomePoiOpen(true);
    } catch (err) {
      if (reqId === homePoiReqRef.current) {
        console.error("[Home] openPoiFromDto:", err);
      }
    } finally {
      if (reqId === homePoiReqRef.current) {
        setOpeningPoi(false);
        setOpeningPoiLabel(null);
      }
    }
  }, []);

  useEffect(() => {
    const handleOpenPoi = async (event: Event) => {
      const customEvent = event as CustomEvent<{ poiId: number; label?: string }>;
      const poiId = customEvent?.detail?.poiId;
      const label = customEvent?.detail?.label ?? null;

      if (!poiId) return;

      const reqId = ++homePoiReqRef.current;

      setOpeningPoi(true);
      setOpeningPoiLabel(label);
      setHomePoiOpen(false);
      setHomePoiInfo(null);
      setHomePoiFeature(null);

      try {
        const dto = await fetchPoiById(poiId);
        if (reqId !== homePoiReqRef.current || !dto) return;
        await openPoiFromDto(dto);
      } catch (err) {
        if (reqId === homePoiReqRef.current) {
          console.error("[Home] pt:open-poi:", err);
        }
      } finally {
        if (reqId === homePoiReqRef.current) {
          setOpeningPoi(false);
          setOpeningPoiLabel(null);
        }
      }
    };

    window.addEventListener("pt:open-poi", handleOpenPoi as EventListener);
    return () => window.removeEventListener("pt:open-poi", handleOpenPoi as EventListener);
  }, [openPoiFromDto]);

  const handlePickFromTop = useCallback(
    (item: SearchItem) => {
      if (item.kind === "district") {
        const feature =
          featureByName.get(normalizeDistrictKey(item.name)) ??
          (item.id != null ? districtFeatureById.get(item.id) : null);

        if (!feature) return;

        zoomToFeatureBounds(feature);
        openDistrictModal(feature);
        return;
      }

      const reqId = ++homePoiReqRef.current;

      setOpeningPoi(true);
      setOpeningPoiLabel(item.name || null);
      setHomePoiOpen(false);
      setHomePoiInfo(null);
      setHomePoiFeature(null);

      fetchPoiById(item.id)
        .then((dto) => {
          if (reqId !== homePoiReqRef.current || !dto) return;
          return openPoiFromDto(dto);
        })
        .catch((err) => {
          if (reqId === homePoiReqRef.current) {
            console.error("[Home] handlePickFromTop:", err);
          }
        })
        .finally(() => {
          if (reqId === homePoiReqRef.current) {
            setOpeningPoi(false);
            setOpeningPoiLabel(null);
          }
        });
    },
    [districtFeatureById, featureByName, openDistrictModal, openPoiFromDto, zoomToFeatureBounds]
  );

  const dataReady = Boolean(ptGeo && districtsGeo);

  return (
    <>
      {!dataReady && <LoadingOverlay message="A carregar o mapa de Portugal" />}

      {openingPoi && (
        <SpinnerOverlay
          open={openingPoi}
          message={openingPoiLabel ? openingPoiLabel : "A abrir ponto…"}
        />
      )}

      {openingDistrict && (
        <SpinnerOverlay
          open={openingDistrict}
          message={openingDistrictLabel ? openingDistrictLabel : "A abrir distrito…"}
        />
      )}

      {!isDistrictModalOpen && (
        <div className="top-district-filter">
          <div className="tdf-inner">
            <TopDistrictFilter onPick={handlePickFromTop} />
          </div>
        </div>
      )}

      <div className="map-shell">
        <MapContainer
          ref={mapRef as any}
          center={initialCenter}
          zoom={isMobile ? 6 : 5.5}
          whenReady={() => {
            const map = mapRef.current;
            if (!map) return;

            if (isMobile) fitContinentalPT(map, false);
            else if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, false);
          }}
          scrollWheelZoom
          dragging
          doubleClickZoom
          attributionControl
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1.0}
          minZoom={2}
          style={{ height: "100vh", width: "100vw" }}
        >
          <Pane name="worldBase" style={{ zIndex: 200, pointerEvents: "none" }}>
            <TileLayer
              url={WORLD_BASE}
              attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              noWrap
            />
          </Pane>

          <Pane name="worldLabels" style={{ zIndex: 210, pointerEvents: "none" }}>
            <TileLayer
              url={WORLD_LABELS}
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              noWrap
            />
          </Pane>

          {districtsGeo && (
            <DistrictsHoverLayer
              data={districtsGeo as any}
              onClickDistrict={(_, feature) => feature && openDistrictModal(feature)}
              capitalsByDistrictId={new Map()}
            />
          )}
        </MapContainer>
      </div>

      <DistrictModal
        open={isDistrictModalOpen}
        onClose={closeDistrictModal}
        districtFeature={activeDistrictFeature}
        isAdmin={isAdmin}
        onLoaded={() => {
          setOpeningDistrict(false);
          setOpeningDistrictLabel(null);
        }}
      />

      <PoiModal
        open={homePoiOpen}
        onClose={() => {
          setHomePoiOpen(false);
          setHomePoiInfo(null);
          setHomePoiFeature(null);
        }}
        info={homePoiInfo}
        poi={homePoiFeature}
        isAdmin={isAdmin}
      />

      <LoginModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onOpenRegister={() => {
          setShowLoginModal(false);
          setProfileModalMode("create");
          setShowProfileModal(true);
        }}
      />

      <ProfileModal
        open={showProfileModal}
        mode={profileModalMode}
        onClose={() => setShowProfileModal(false)}
      />

      <CreatePoiModal
        open={showCreatePoiModal}
        onClose={closeCreatePoi}
      />
    </>
  );
}