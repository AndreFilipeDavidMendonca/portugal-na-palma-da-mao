// src/pages/Home.tsx
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { type PoiCategory, WORLD_BASE, WORLD_LABELS } from "@/utils/constants";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";

import { fetchDistricts, fetchPoiById, fetchPoisLiteBbox, type PoiDto, type SearchItem } from "@/lib/api";

import PoiModal from "@/pages/poi/PoiModal";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import TopDistrictFilter from "@/features/topbar/TopDistrictFilter";
import { useAuth } from "@/auth/AuthContext";

type AnyGeo = any;

const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);
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
            id: p.id,
            poiId: p.id,
            districtId: p.districtId ?? null,
            ownerId: p.ownerId ?? null,

            name: p.name,
            namePt: p.namePt ?? p.name,

            category,
            subcategory: p.subcategory ?? null,

            description: p.description ?? null,
            wikipediaUrl: p.wikipediaUrl ?? null,
            sipaId: p.sipaId ?? null,
            externalOsmId: p.externalOsmId ?? null,
            source: p.source ?? null,

            image: p.image ?? null,
            images: p.images ?? [],

            historic: category || "poi",
            tags: { category, subcategory: p.subcategory ?? null },
        },
    };
}

export default function Home() {
    // Auth (só sessão)
    const { user } = useAuth();
    const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin", [user]);

    // Geo
    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    // District modal state
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(null);
    const [activeDistrictPois, setActiveDistrictPois] = useState<AnyGeo | null>(null);

    // Map ref
    const mapRef = useRef<L.Map | null>(null);

    // POI modal (Home)
    const [homePoiOpen, setHomePoiOpen] = useState(false);
    const [homePoiInfo, setHomePoiInfo] = useState<PoiInfo | null>(null);
    const [homePoiFeature, setHomePoiFeature] = useState<any | null>(null);
    const homePoiReqRef = useRef(0);

    const CONTINENTAL_PT_BOUNDS = L.latLngBounds([36.90, -7.50], [42.15, -5.90]);
    const isMobile = useMediaQuery("(max-width: 900px)");

    const initialCenter = useMemo<[number, number]>(() => {
        if (isMobile) return [37.5, -8.0];
        return [37.0, -15.0];
    }, [isMobile]);

    const [activeBbox, setActiveBbox] = useState<string | null>(null);
    const [countsByCat, setCountsByCat] = useState<Partial<Record<PoiCategory, number>>>({});

    function isMobileViewport() {
        return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
    }

    /* =========================
       Geo
    ========================= */

    const reqRef = useRef(0);

    useEffect(() => {
        if (!isModalOpen || !activeBbox) return;

        const selected = Array.from(selectedPoiTypes);

        if (selected.length === 0) {
            setActiveDistrictPois({ type: "FeatureCollection", features: [] });
            return;
        }

        const reqId = ++reqRef.current;
        const controller = new AbortController();

        (async () => {
            try {
                const limit = 5000;

                if (selected.length === 1) {
                    const res = await fetchPoisLiteBbox(activeBbox, {
                        category: selected[0],
                        limit,
                        signal: controller.signal,
                    });

                    if (reqRef.current !== reqId) return;

                    setActiveDistrictPois({
                        type: "FeatureCollection",
                        features: res.pois.map((p) => ({
                            type: "Feature",
                            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
                            properties: {
                                id: p.id,
                                name: p.name,
                                namePt: p.namePt ?? p.name,
                                category: p.category,
                                ownerId: p.ownerId,
                            },
                        })),
                    });
                } else {
                    const res = await fetchPoisLiteBbox(activeBbox, {
                        limit,
                        signal: controller.signal,
                    });

                    if (reqRef.current !== reqId) return;

                    const sel = new Set(selected);

                    setActiveDistrictPois({
                        type: "FeatureCollection",
                        features: res.pois
                            .filter((p) => p.category && sel.has(p.category as PoiCategory))
                            .map((p) => ({
                                type: "Feature",
                                geometry: { type: "Point", coordinates: [p.lon, p.lat] },
                                properties: {
                                    id: p.id,
                                    name: p.name,
                                    namePt: p.namePt ?? p.name,
                                    category: p.category,
                                    ownerId: p.ownerId,
                                },
                            })),
                    });
                }
            } catch (e: any) {
                if (e.name !== "AbortError") console.error("Erro ao buscar POIs:", e);
            }
        })();

        return () => controller.abort();
    }, [selectedPoiTypes, activeBbox, isModalOpen]);

    const norm = (s: string) =>
        (s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/^\s*distrito\s+de\s+/i, "")
            .trim()
            .toLowerCase();

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

                // ✅ buscar distritos do backend
                const apiDistricts = await fetchDistricts();

                const idByName = new Map<string, number>();
                for (const d of apiDistricts ?? []) {
                    if (d.name) idByName.set(norm(d.name), d.id);
                    if (d.namePt) idByName.set(norm(d.namePt), d.id);
                    if (d.code) idByName.set(norm(d.code), d.id); // bonus (se fizer sentido)
                }

                const patched = {
                    ...distData,
                    features: (distData.features ?? []).map((f: any) => {
                        const p = f?.properties ?? {};
                        const name = p.name || p.NAME || p["name:pt"] || "";
                        const code = p.code || p.COD || p.DICOFRE || ""; // se existir, fica bonus
                        const dbId =
                            idByName.get(norm(code)) ??
                            idByName.get(norm(name)) ??
                            null;

                        return {
                            ...f,
                            properties: {
                                ...p,
                                districtDbId: dbId, // ✅ ID do backend
                                geoId: p.id ?? null // opcional: guarda o antigo
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

    /* =========================
       Feature indexes (GeoJSON only)
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
       Map utils
    ========================= */
    const fitGeoJSONBoundsTight = useCallback((map: L.Map, geo: any, animate = true) => {
        if (!map || !geo) return;
        try {
            const gj = L.geoJSON(geo);
            const bounds = gj.getBounds();
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
        const gj = L.geoJSON(feature);
        const b = gj.getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08), { animate: true });
    }, []);

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

    /* =========================
       District modal
    ========================= */
    const togglePoiType = useCallback((k: PoiCategory) => {
        setSelectedPoiTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }, []);

    const clearPoiTypes = useCallback(() => setSelectedPoiTypes(new Set()), []);

    function bboxFromFeature(feature: any): string | null {
        try {
            const gj = L.geoJSON(feature);
            const b = gj.getBounds();
            if (!b.isValid()) return null;
            return `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
        } catch {
            return null;
        }
    }

    const openDistrictModal = useCallback(async (feature: any) => {
        setActiveDistrictFeature(feature);
        setIsModalOpen(true);
        setSelectedPoiTypes(new Set());
        setActiveDistrictPois({ type: "FeatureCollection", features: [] });
        setCountsByCat({});

        const bbox = bboxFromFeature(feature);
        setActiveBbox(bbox);

        if (!bbox) return;

        try {
            const res = await fetchPoisLiteBbox(bbox, { limit: 1 });

            const next: Partial<Record<PoiCategory, number>> = {};
            for (const [k, v] of Object.entries(res.countsByCategory ?? {})) {
                next[k as PoiCategory] = Number(v ?? 0);
            }

            setCountsByCat(next);
        } catch (e) {
            console.error("Erro ao carregar counts:", e);
        }
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setActiveDistrictFeature(null);
        setActiveDistrictPois(null);

        const map = mapRef.current;
        if (!map) return;

        if (isMobileViewport()) fitContinentalPT(map, true);
        else if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, true);
    }, [fitContinentalPT, fitGeoJSONBoundsTight, ptGeo]);

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

        setHomePoiOpen(false);
        setHomePoiInfo(null);

        const feature = poiDtoToFeature(poiDto);
        setHomePoiFeature(feature);

        const label = pickPoiLabelFromDto(poiDto);
        if (!label) return;

        const base = await fetchPoiInfo({
            approx: { name: label, lat: poiDto.lat, lon: poiDto.lon },
            sourceFeature: feature,
        });

        if (reqId !== homePoiReqRef.current) return;
        if (!base) return;

        const merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);
        const infoNow: PoiInfo = { ...base, image: merged[0] ?? base.image ?? null, images: merged };

        setHomePoiInfo(infoNow);
        setHomePoiOpen(true);
    }, []);

    useEffect(() => {
        const handler = async (e: Event) => {
            const ce = e as CustomEvent<{ poiId: number }>;
            const poiId = ce?.detail?.poiId;
            if (!poiId) return;

            try {
                const dto = await fetchPoiById(poiId);
                if (dto) await openPoiFromDto(dto);
            } catch (err) {
                console.error("[Home] Falha ao abrir POI por id:", err);
            }
        };

        window.addEventListener("pt:open-poi", handler as any);
        return () => window.removeEventListener("pt:open-poi", handler as any);
    }, [openPoiFromDto]);

    /* =========================
       Top search pick (server-side)
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

            fetchPoiById(item.id)
                .then((dto) => dto && openPoiFromDto(dto))
                .catch((e) => console.error("[Home] Falha fetchPoiById:", e));
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

            {!isModalOpen && (
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
                        <TileLayer url={WORLD_LABELS} attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' noWrap />
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
                open={isModalOpen}
                onClose={handleCloseModal}
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