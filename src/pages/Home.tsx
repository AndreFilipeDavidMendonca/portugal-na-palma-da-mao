// src/pages/Home.tsx
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { WORLD_BASE, WORLD_LABELS } from "@/utils/constants";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";

import { fetchDistricts, fetchPoiById, type PoiDto, type SearchItem } from "@/lib/api";
import PoiModal from "@/pages/poi/PoiModal";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";
import { useAuth } from "@/auth/AuthContext";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";

type AnyGeo = any;

const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);
const CONTINENTAL_PT_BOUNDS = L.latLngBounds([36.90, -7.50], [42.15, -5.90]);

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

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia(query).matches : false
    );

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);

        if ("addEventListener" in mql) mql.addEventListener("change", onChange);
        else (mql as any).addListener(onChange);

        setMatches(mql.matches);

        return () => {
            if ("removeEventListener" in mql) mql.removeEventListener("change", onChange);
            else (mql as any).removeListener(onChange);
        };
    }, [query]);

    return matches;
}

export default function Home() {
    const { user } = useAuth();
    const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin", [user]);

    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    const [isDistrictModalOpen, setIsDistrictModalOpen] = useState(false);
    const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(null);

    const mapRef = useRef<L.Map | null>(null);

    // POI modal (Home)
    const [homePoiOpen, setHomePoiOpen] = useState(false);
    const [homePoiInfo, setHomePoiInfo] = useState<PoiInfo | null>(null);
    const [homePoiFeature, setHomePoiFeature] = useState<any | null>(null);
    const homePoiReqRef = useRef(0);

    // Spinner apenas para "a abrir POI" (não confundir com LoadingOverlay do arranque)
    const [openingPoi, setOpeningPoi] = useState(false);
    const [openingPoiLabel, setOpeningPoiLabel] = useState<string | null>(null);

    const isMobile = useMediaQuery("(max-width: 900px)");

    const initialCenter = useMemo<[number, number]>(() => {
        return isMobile ? [37.5, -8.0] : [37.0, -15.0];
    }, [isMobile]);

    const norm = (s: string) =>
        (s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/^\s*distrito\s+de\s+/i, "")
            .trim()
            .toLowerCase();

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
            console.error("[fitGeoJSONBoundsTight] erro:", err);
        }
    }, []);

    const zoomToFeatureBounds = useCallback((feature: any) => {
        const map = mapRef.current;
        if (!map || !feature) return;
        const b = L.geoJSON(feature).getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08), { animate: true });
    }, []);

    /* =========================
       Load Geo + patch district ids
    ========================= */
    useEffect(() => {
        let aborted = false;

        (async () => {
            try {
                const [ptData, distData] = await Promise.all([
                    loadGeo("/geo/portugal.geojson"),
                    loadGeo("/geo/distritos.geojson").catch(() => null),
                ]);

                if (aborted) return;

                setPtGeo(ptData);

                if (!distData) {
                    setDistrictsGeo(null);
                    return;
                }

                const apiDistricts = await fetchDistricts();

                const idByName = new Map<string, number>();
                for (const d of apiDistricts ?? []) {
                    if (d.name) idByName.set(norm(d.name), d.id);
                    if (d.namePt) idByName.set(norm(d.namePt), d.id);
                    if (d.code) idByName.set(norm(d.code), d.id);
                }

                const patched = {
                    ...distData,
                    features: (distData.features ?? []).map((f: any) => {
                        const p = f?.properties ?? {};
                        const name = p.name || p.NAME || p["name:pt"] || "";
                        const code = p.code || p.COD || p.DICOFRE || "";

                        const dbId = idByName.get(norm(code)) ?? idByName.get(norm(name)) ?? null;

                        return {
                            ...f,
                            properties: {
                                ...p,
                                districtDbId: dbId,
                                geoId: p.id ?? null,
                            },
                        };
                    }),
                };

                setDistrictsGeo(patched);
            } catch (e) {
                console.error("[geo] Falha ao carregar PT/distritos:", e);
            }
        })();

        return () => {
            aborted = true;
        };
    }, []);

    /* =========================
       Indexes (district search)
    ========================= */
    const featureByName = useMemo(() => {
        const m = new Map<string, any>();
        for (const f of districtsGeo?.features ?? []) {
            const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"];
            if (name) m.set(norm(name), f);
        }
        return m;
    }, [districtsGeo]);

    const districtFeatureById = useMemo(() => {
        const m = new Map<number, any>();
        for (const f of districtsGeo?.features ?? []) {
            const id = f?.properties?.districtDbId;
            if (typeof id === "number" && Number.isFinite(id)) m.set(id, f);
        }
        return m;
    }, [districtsGeo]);

    /* =========================
       District modal open/close
    ========================= */
    const openDistrictModal = useCallback((feature: any) => {
        setActiveDistrictFeature(feature);
        setIsDistrictModalOpen(true);
    }, []);

    const handleCloseDistrictModal = useCallback(() => {
        setIsDistrictModalOpen(false);
        setActiveDistrictFeature(null);

        const map = mapRef.current;
        if (!map) return;

        if (isMobile) fitContinentalPT(map, true);
        else if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, true);
    }, [fitContinentalPT, fitGeoJSONBoundsTight, isMobile, ptGeo]);

    const handleClickDistrict = useCallback(
        (_name: string | undefined, feature: any) => {
            if (feature) openDistrictModal(feature);
        },
        [openDistrictModal]
    );

    /* =========================
       POI modal (Home)
    ========================= */
    const openPoiFromDto = useCallback(async (poiDto: PoiDto) => {
        const reqId = ++homePoiReqRef.current;

        const label = pickPoiLabelFromDto(poiDto);
        setOpeningPoi(true);
        setOpeningPoiLabel(label || null);

        // limpa UI atual para evitar “flash” do conteúdo antigo
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

            if (reqId !== homePoiReqRef.current) return;
            if (!base) return;

            const merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);
            const infoNow: PoiInfo = {
                ...base,
                image: merged[0] ?? base.image ?? null,
                images: merged,
            };

            setHomePoiInfo(infoNow);
            setHomePoiOpen(true);
        } catch (e) {
            if (reqId === homePoiReqRef.current) {
                console.error("[Home] Falha fetchPoiInfo:", e);
            }
        } finally {
            if (reqId === homePoiReqRef.current) {
                setOpeningPoi(false);
                setOpeningPoiLabel(null);
            }
        }
    }, []);

    useEffect(() => {
        const handler = async (e: Event) => {
            const ce = e as CustomEvent<{ poiId: number; label?: string }>;
            const poiId = ce?.detail?.poiId;
            const label = ce?.detail?.label ?? null;
            if (!poiId) return;

            const reqId = ++homePoiReqRef.current;

            setOpeningPoi(true);
            setOpeningPoiLabel(label);

            // limpa UI atual para evitar “flash”
            setHomePoiOpen(false);
            setHomePoiInfo(null);
            setHomePoiFeature(null);

            try {
                const dto = await fetchPoiById(poiId);
                if (reqId !== homePoiReqRef.current) return;
                if (dto) await openPoiFromDto(dto);
            } catch (err) {
                if (reqId === homePoiReqRef.current) {
                    console.error("[Home] Falha ao abrir POI por id:", err);
                }
            } finally {
                // openPoiFromDto também controla spinner, mas este finally garante que nunca fica preso
                if (reqId === homePoiReqRef.current) {
                    setOpeningPoi(false);
                    setOpeningPoiLabel(null);
                }
            }
        };

        window.addEventListener("pt:open-poi", handler as any);
        return () => window.removeEventListener("pt:open-poi", handler as any);
    }, [openPoiFromDto]);

    /* =========================
       Top search pick
    ========================= */
    const handlePickFromTop = useCallback(
        (item: SearchItem) => {
            if (item.kind === "district") {
                const f =
                    featureByName.get(norm(item.name)) ??
                    (item.id != null ? districtFeatureById.get(item.id) : null);

                if (!f) return;
                zoomToFeatureBounds(f);
                openDistrictModal(f);
                return;
            }

            const reqId = ++homePoiReqRef.current;

            setOpeningPoi(true);
            setOpeningPoiLabel(item.name || null);

            // limpa UI atual para evitar “flash”
            setHomePoiOpen(false);
            setHomePoiInfo(null);
            setHomePoiFeature(null);

            fetchPoiById(item.id)
                .then((dto) => {
                    if (reqId !== homePoiReqRef.current) return;
                    if (dto) return openPoiFromDto(dto);
                })
                .catch((e) => {
                    if (reqId === homePoiReqRef.current) {
                        console.error("[Home] Falha fetchPoiById:", e);
                    }
                })
                .finally(() => {
                    // openPoiFromDto também controla, mas este finally garante que nunca fica preso
                    if (reqId === homePoiReqRef.current) {
                        setOpeningPoi(false);
                        setOpeningPoiLabel(null);
                    }
                });
        },
        [districtFeatureById, featureByName, openDistrictModal, openPoiFromDto, zoomToFeatureBounds]
    );

    /* =========================
       Render
    ========================= */
    const dataReady = Boolean(ptGeo && districtsGeo);
    const showOverlay = !dataReady;

    return (
        <>
            {showOverlay && <LoadingOverlay message="A carregar o mapa de Portugal" />}

            {openingPoi && (
                <SpinnerOverlay
                    message={openingPoiLabel ? openingPoiLabel : "A abrir ponto…"}
                    open={openingPoi}
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
                            onClickDistrict={handleClickDistrict}
                            capitalsByDistrictId={new Map()}
                        />
                    )}
                </MapContainer>
            </div>

            <DistrictModal
                open={isDistrictModalOpen}
                onClose={handleCloseDistrictModal}
                districtFeature={activeDistrictFeature}
                isAdmin={isAdmin}
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
        </>
    );
}