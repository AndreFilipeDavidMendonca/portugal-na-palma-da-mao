// src/pages/home/HomePage.tsx
import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { type PoiCategory, WORLD_BASE, WORLD_LABELS } from "@/utils/constants";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay/LoadingOverlay";
import TopDistrictFilter, { type SearchItem } from "@/features/topbar/TopDistrictFilter";

import {
    type CurrentUserDto,
    type DistrictDto,
    fetchCurrentUser,
    fetchDistricts,
    fetchPois,
    fetchPoiById,
    type PoiDto,
} from "@/lib/api";

import { filterPointsInsideDistrict } from "@/lib/spatial";

import PoiModal from "@/pages/poi/PoiModal";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import SpinnerOverlay from "@/components/SpinnerOverlay/SpinnerOverlay";

import { isCommercialCategory, normalizeCat } from "@/utils/poiCategory";
import {searchWikimediaIfAllowed} from "@/lib/wikiGate";

type AnyGeo = any;

const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);

/* =========================
   Helpers (local, simples)
========================= */

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

function pickPoiLabelFromDto(p: PoiDto): string {
    return (p.namePt ?? p.name ?? "").trim();
}

function normalizeCategory(p: PoiDto): PoiCategory | string | null {
    // category já vem normalizada (gastronomy, etc.)
    return p.category ?? null;
}

function poiDtoToFeature(p: PoiDto): any {
    const category = normalizeCategory(p);

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

function poiDtosToGeoJSON(pois: PoiDto[]): AnyGeo {
    return { type: "FeatureCollection", features: (pois ?? []).map(poiDtoToFeature) };
}

/* =========================
   Component
========================= */

export default function Home() {
    // ----- Geo base -----
    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    // ----- Distritos (API) -----
    const [districtDtos, setDistrictDtos] = useState<DistrictDto[]>([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    // ----- POIs (API) -----
    const [allPois, setAllPois] = useState<PoiDto[]>([]);
    const [loadingAllPois, setLoadingAllPois] = useState(false);

    // ----- Utilizador atual -----
    const [currentUser, setCurrentUser] = useState<CurrentUserDto | null>(null);

    // ----- Filtros POI (DistrictModal) -----
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(new Set());

    // ----- Modal de Distrito -----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(null);

    const [activeDistrictPois, setActiveDistrictPois] = useState<AnyGeo | null>(null);
    const [loadingDistrictPois, setLoadingDistrictPois] = useState(false);
    const poisReqRef = useRef(0);

    // Map ref
    const mapRef = useRef<L.Map | null>(null);

    // ----- POI Modal (Home) -----
    const [homePoiOpen, setHomePoiOpen] = useState(false);
    const [homePoiLoading, setHomePoiLoading] = useState(false);
    const [homePoiInfo, setHomePoiInfo] = useState<PoiInfo | null>(null);
    const [homePoiFeature, setHomePoiFeature] = useState<any | null>(null);
    const homePoiReqRef = useRef(0);

    /* =========================
       Current user
    ========================= */

    useEffect(() => {
        let alive = true;
        fetchCurrentUser()
            .then((u) => alive && setCurrentUser(u))
            .catch(() => alive && setCurrentUser(null));
        return () => {
            alive = false;
        };
    }, []);

    const isAdmin = useMemo(() => currentUser?.role?.toLowerCase() === "admin", [currentUser]);

    /* =========================
       Load Geo
    ========================= */

    useEffect(() => {
        let aborted = false;

        Promise.all([loadGeo("/geo/portugal.geojson"), loadGeo("/geo/distritos.geojson").catch(() => null)])
            .then(([ptData, distData]) => {
                if (aborted) return;
                setPtGeo(ptData);
                setDistrictsGeo(distData);
            })
            .catch((e) => console.error("[geo] Falha ao carregar PT/distritos:", e));

        return () => {
            aborted = true;
        };
    }, []);

    /* =========================
       Load API data
    ========================= */

    useEffect(() => {
        let alive = true;
        setLoadingDistricts(true);
        fetchDistricts()
            .then((ds) => alive && setDistrictDtos(ds ?? []))
            .catch((e) => console.error("[api] Falha a carregar distritos:", e))
            .finally(() => alive && setLoadingDistricts(false));
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        let alive = true;
        setLoadingAllPois(true);
        fetchPois()
            .then((ps) => alive && setAllPois(ps ?? []))
            .catch((e) => console.error("[api] Falha a carregar POIs (Top search):", e))
            .finally(() => alive && setLoadingAllPois(false));
        return () => {
            alive = false;
        };
    }, []);

    /* =========================
       Indexes
    ========================= */

    const districtDtoByName = useMemo(() => {
        const m = new Map<string, DistrictDto>();
        for (const d of districtDtos) {
            if (d.namePt) m.set(d.namePt, d);
            if (d.name) m.set(d.name, d);
        }
        return m;
    }, [districtDtos]);

    const districtDtoById = useMemo(() => {
        const m = new Map<number, DistrictDto>();
        for (const d of districtDtos) {
            if (typeof (d as any).id === "number") m.set((d as any).id, d);
        }
        return m;
    }, [districtDtos]);

    const featureByName = useMemo(() => {
        const m = new Map<string, any>();
        for (const f of districtsGeo?.features ?? []) {
            const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"];
            if (name) m.set(name, f);
        }
        return m;
    }, [districtsGeo]);

    // tenta id direto; fallback dto.id -> dto.name -> featureByName
    const districtFeatureById = useMemo(() => {
        const m = new Map<number, any>();

        for (const f of districtsGeo?.features ?? []) {
            const id = f?.properties?.id;
            if (typeof id === "number") m.set(id, f);
        }

        if (m.size === 0 && districtDtos.length > 0) {
            for (const d of districtDtos) {
                const id = (d as any).id;
                const name = d.namePt ?? d.name;
                if (typeof id === "number" && name) {
                    const f = featureByName.get(name);
                    if (f) m.set(id, f);
                }
            }
        }

        return m;
    }, [districtsGeo, districtDtos, featureByName]);

    const districtNames = useMemo(
        () => Array.from(featureByName.keys()).sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" })),
        [featureByName]
    );

    const poiSearchItems = useMemo(() => {
        return (allPois ?? [])
            .map((p) => ({ id: p.id, districtId: p.districtId ?? null, name: pickPoiLabelFromDto(p) }))
            .filter((p) => p.name && p.name.length >= 3);
    }, [allPois]);

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

    /* =========================
       District modal
    ========================= */

    const togglePoiType = (k: PoiCategory) => {
        setSelectedPoiTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };

    const clearPoiTypes = () => setSelectedPoiTypes(new Set());

    const loadPoisForDistrictFeature = useCallback(
        async (feature: any) => {
            const name = feature?.properties?.name || feature?.properties?.NAME || feature?.properties?.["name:pt"];
            if (!name) return setActiveDistrictPois(null);

            const dto = districtDtoByName.get(name);
            if (!dto) return setActiveDistrictPois(null);

            const reqId = ++poisReqRef.current;
            setLoadingDistrictPois(true);
            setActiveDistrictPois(null);

            try {
                const pois = allPois.length ? allPois : await fetchPois();
                if (reqId !== poisReqRef.current) return;

                const allGeo = poiDtosToGeoJSON(pois);
                const clipped = filterPointsInsideDistrict(allGeo, feature) ?? { type: "FeatureCollection", features: [] };
                setActiveDistrictPois(clipped);
            } catch (e) {
                console.error("[api] Falha a carregar POIs do distrito:", e);
                if (reqId === poisReqRef.current) setActiveDistrictPois(null);
            } finally {
                if (reqId === poisReqRef.current) setLoadingDistrictPois(false);
            }
        },
        [allPois, districtDtoByName]
    );

    const openDistrictModal = useCallback(
        async (feature: any) => {
            setActiveDistrictFeature(feature);
            setIsModalOpen(true);
            await loadPoisForDistrictFeature(feature);
        },
        [loadPoisForDistrictFeature]
    );

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
        setActiveDistrictFeature(null);
        setActiveDistrictPois(null);

        const map = mapRef.current;
        if (map && ptGeo) fitGeoJSONBoundsTight(map, ptGeo);
    }, [fitGeoJSONBoundsTight, ptGeo]);

    /* =========================
       POI modal (Home)
    ========================= */

    const openPoiFromDto = useCallback(async (poiDto: PoiDto) => {
        const reqId = ++homePoiReqRef.current;

        setHomePoiLoading(true);
        setHomePoiOpen(false);
        setHomePoiInfo(null);

        const feature = poiDtoToFeature(poiDto);
        setHomePoiFeature(feature);

        try {
            const label = pickPoiLabelFromDto(poiDto);
            if (!label) return;

            const base = await fetchPoiInfo({
                approx: { name: label, lat: poiDto.lat, lon: poiDto.lon },
                sourceFeature: feature,
            });

            if (reqId !== homePoiReqRef.current) return;
            if (!base) return;

            // ✅ wiki só para não-comerciais
            const featureCat: PoiCategory | null = normalizeCat(feature?.properties?.category);
            const allowWiki = !isCommercialCategory(featureCat);

            let merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

            if (merged.length < 10) {
                const wiki10 = await searchWikimediaIfAllowed(label, 10, base.category);
                if (reqId !== homePoiReqRef.current) return;
                merged = uniqStrings([...merged, ...(wiki10 ?? [])]).slice(0, 10);
            }

            const infoNow: PoiInfo = { ...base, image: merged[0] ?? base.image ?? null, images: merged };
            setHomePoiInfo(infoNow);
            setHomePoiOpen(true);
        } finally {
            if (reqId === homePoiReqRef.current) setHomePoiLoading(false);
        }
    }, []);

    // ✅ listener estável para abrir POI por id
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
       Top search pick
    ========================= */

    const handlePickFromTop = useCallback(
        (item: SearchItem) => {
            if (item.kind === "district") {
                const f = featureByName.get(item.name);
                if (!f) return;
                zoomToFeatureBounds(f);
                openDistrictModal(f);
                return;
            }

            const poiDto = allPois.find((p) => p.id === item.id);
            if (poiDto) openPoiFromDto(poiDto);

            const districtId = item.districtId ?? null;
            const districtFeature = districtId != null ? districtFeatureById.get(districtId) : null;

            if (districtFeature) {
                zoomToFeatureBounds(districtFeature);
                openDistrictModal(districtFeature);
            } else if (districtId != null) {
                const dto = districtDtoById.get(districtId);
                const name = dto?.namePt ?? dto?.name ?? null;
                if (name) {
                    const f = featureByName.get(name);
                    if (f) {
                        zoomToFeatureBounds(f);
                        openDistrictModal(f);
                    }
                }
            }
        },
        [
            allPois,
            districtDtoById,
            districtFeatureById,
            featureByName,
            openDistrictModal,
            openPoiFromDto,
            zoomToFeatureBounds,
        ]
    );

    /* =========================
       Render
    ========================= */

    const dataReady = Boolean(ptGeo && districtsGeo && !loadingDistricts);
    const showOverlay = !dataReady;

    return (
        <>
            {showOverlay && <LoadingOverlay message="A carregar o mapa de Portugal…" />}

            {!isModalOpen && (
                <div className="top-district-filter">
                    <div className="tdf-inner">
                        <TopDistrictFilter
                            districts={districtNames}
                            pois={poiSearchItems}
                            onPick={handlePickFromTop}
                            loadingPois={loadingAllPois}
                        />
                    </div>
                </div>
            )}

            <div className="map-shell">
                <MapContainer
                    ref={mapRef as any}
                    center={[37, -15]}
                    zoom={5.5}
                    whenReady={() => {
                        const map = mapRef.current;
                        if (map && ptGeo) fitGeoJSONBoundsTight(map, ptGeo, false);
                    }}
                    scrollWheelZoom
                    dragging
                    doubleClickZoom
                    attributionControl
                    preferCanvas
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
                            onClickDistrict={(_name, feature) => feature && openDistrictModal(feature)}
                        />
                    )}
                </MapContainer>
            </div>

            <DistrictModal
                open={isModalOpen}
                onClose={handleCloseModal}
                districtFeature={activeDistrictFeature}
                selectedTypes={selectedPoiTypes}
                onToggleType={togglePoiType}
                onClearTypes={clearPoiTypes}
                poiPoints={activeDistrictPois}
                isAdmin={isAdmin}
            />

            {loadingDistrictPois && <LoadingOverlay message="A carregar…" />}
            {homePoiLoading && <SpinnerOverlay open={homePoiLoading} message="A carregar…" />}

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
                onSaved={(patch) => {
                    // ✅ mantém allPois coerente
                    setAllPois((prev) =>
                        prev.map((p) =>
                            p.id === patch.id
                                ? {
                                    ...p,
                                    name: patch.name ?? p.name,
                                    namePt: patch.namePt ?? p.namePt,
                                    description: patch.description ?? p.description,
                                    image: patch.image ?? p.image,
                                    images: patch.images ?? p.images,
                                }
                                : p
                        )
                    );

                    // ✅ mantém o feature atual coerente (evita reabrir com imagens antigas)
                    setHomePoiFeature((prev: any) => {
                        if (!prev?.properties || prev.properties.id !== patch.id) return prev;
                        return {
                            ...prev,
                            properties: {
                                ...prev.properties,
                                name: patch.name ?? prev.properties.name,
                                namePt: patch.namePt ?? prev.properties.namePt,
                                description: patch.description ?? prev.properties.description,
                                image: patch.image ?? prev.properties.image,
                                images: patch.images ?? prev.properties.images,
                            },
                        };
                    });
                }}
            />
        </>
    );
}