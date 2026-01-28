import { MapContainer, Pane, TileLayer } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

import { loadGeo } from "@/lib/geo";
import DistrictsHoverLayer from "@/features/map/DistrictsHoverLayer";
import { type PoiCategory, WORLD_BASE, WORLD_LABELS } from "@/utils/constants";
import DistrictModal from "@/pages/district/DistrictModal";
import LoadingOverlay from "@/components/LoadingOverlay";
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

// ✅ POI modal (no Home)
import PoiModal from "@/pages/poi/PoiModal";
import { fetchPoiInfo, type PoiInfo } from "@/lib/poiInfo";
import { searchWikimediaImagesByName } from "@/lib/wikimedia";
import SpinnerOverlay from "@/components/SpinnerOverlay";

type AnyGeo = any;

const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

function pickPoiLabelFromDto(p: PoiDto): string {
    return (p.namePt ?? p.name ?? "").trim();
}

const BUSINESS_SUBCAT_MAP: Record<string, PoiCategory> = {
    evento: "event",
    artesanato: "crafts",
    gastronomia: "gastronomy",
    alojamento: "accommodation",
};

function normalizeCategory(p: PoiDto): PoiCategory | string | null {
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

    // ----- Filtros POI (dentro do DistrictModal) -----
    const [selectedPoiTypes, setSelectedPoiTypes] = useState<Set<PoiCategory>>(new Set());

    // ----- Modal de Distrito -----
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeDistrictFeature, setActiveDistrictFeature] = useState<any | null>(null);

    // POIs do distrito ativo (GeoJSON recortado)
    const [activeDistrictPois, setActiveDistrictPois] = useState<AnyGeo | null>(null);
    const [loadingDistrictPois, setLoadingDistrictPois] = useState(false);
    const poisReqRef = useRef(0);

    // Map ref
    const mapRef = useRef<L.Map | null>(null);

    // ✅ POI Modal (no Home)
    const [homePoiOpen, setHomePoiOpen] = useState(false);
    const [homePoiLoading, setHomePoiLoading] = useState(false);
    const [homePoiInfo, setHomePoiInfo] = useState<PoiInfo | null>(null);
    const [homePoiFeature, setHomePoiFeature] = useState<any | null>(null);
    const homePoiReqRef = useRef(0);

    // =========================
    //   Carregar utilizador atual
    // =========================
    useEffect(() => {
        let alive = true;

        fetchCurrentUser()
            .then((u) => {
                if (!alive) return;
                setCurrentUser(u);
            })
            .catch((e) => {
                console.warn("[api] /api/me falhou (não é 401 normal):", e);
                if (!alive) return;
                setCurrentUser(null);
            });

        return () => {
            alive = false;
        };
    }, []);

    const isAdmin = useMemo(() => currentUser?.role?.toLowerCase() === "admin", [currentUser]);

    // =========================
    //   Carregamento de Geo base
    // =========================
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

    // =========================
    //   Carregar distritos via API
    // =========================
    useEffect(() => {
        let alive = true;
        setLoadingDistricts(true);

        fetchDistricts()
            .then((ds) => {
                if (!alive) return;
                setDistrictDtos(ds);
            })
            .catch((e) => console.error("[api] Falha a carregar distritos:", e))
            .finally(() => alive && setLoadingDistricts(false));

        return () => {
            alive = false;
        };
    }, []);

    // =========================
    //   Carregar TODOS os POIs (para o search do topo)
    //   - Não bloqueia o mapa
    // =========================
    useEffect(() => {
        let alive = true;
        setLoadingAllPois(true);

        fetchPois()
            .then((ps) => {
                if (!alive) return;
                setAllPois(ps ?? []);
            })
            .catch((e) => console.error("[api] Falha a carregar POIs (Top search):", e))
            .finally(() => alive && setLoadingAllPois(false));

        return () => {
            alive = false;
        };
    }, []);

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
        if (districtsGeo?.features) {
            for (const f of districtsGeo.features) {
                const name = f?.properties?.name || f?.properties?.NAME || f?.properties?.["name:pt"];
                if (name) m.set(name, f);
            }
        }
        return m;
    }, [districtsGeo]);

    // tenta: id direto no geojson; se não existir, usa dto.id -> dto.name -> featureByName
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
            .map((p) => ({
                id: p.id,
                districtId: p.districtId ?? null,
                name: pickPoiLabelFromDto(p),
            }))
            .filter((p) => p.name && p.name.length >= 3);
    }, [allPois]);

    function togglePoiType(k: PoiCategory) {
        setSelectedPoiTypes((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }

    function clearPoiTypes() {
        setSelectedPoiTypes(new Set());
    }

    async function loadPoisForDistrictFeature(feature: any) {
        if (!feature?.properties) {
            setActiveDistrictPois(null);
            return;
        }

        const name = feature.properties.name || feature.properties.NAME || feature.properties["name:pt"];
        if (!name) {
            setActiveDistrictPois(null);
            return;
        }

        const dto = districtDtoByName.get(name);
        if (!dto) {
            console.warn("[Home] Não encontrei DistrictDto para nome:", name);
            setActiveDistrictPois(null);
            return;
        }

        const reqId = ++poisReqRef.current;
        setLoadingDistrictPois(true);
        setActiveDistrictPois(null);

        try {
            const pois = allPois.length ? allPois : await fetchPois();
            if (reqId !== poisReqRef.current) return;

            const allGeo = poiDtosToGeoJSON(pois);
            const clipped =
                filterPointsInsideDistrict(allGeo, feature) ?? {
                    type: "FeatureCollection",
                    features: [],
                };

            setActiveDistrictPois(clipped);
        } catch (e) {
            console.error("[api] Falha a carregar POIs do distrito:", e);
            if (reqId === poisReqRef.current) setActiveDistrictPois(null);
        } finally {
            if (reqId === poisReqRef.current) setLoadingDistrictPois(false);
        }
    }

    async function openDistrictModal(feature: any) {
        setActiveDistrictFeature(feature);
        setIsModalOpen(true);
        await loadPoisForDistrictFeature(feature);
    }

    function handleCloseModal() {
        setIsModalOpen(false);
        setActiveDistrictFeature(null);
        setActiveDistrictPois(null);
        if (mapRef.current && ptGeo) fitGeoJSONBoundsTight(mapRef.current, ptGeo);
    }

    function onMapReadyNoArg() {
        const map = mapRef.current;
        if (!map) return;
        if (ptGeo) fitGeoJSONBoundsTight(map, ptGeo, false);
    }

    function fitGeoJSONBoundsTight(map: L.Map, geo: any, animate = true) {
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
    }

    function zoomToFeatureBounds(feature: any) {
        const map = mapRef.current;
        if (!map) return;
        const gj = L.geoJSON(feature);
        const b = gj.getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08), { animate: true });
    }

    // =========================
    //   ✅ POI modal no Home
    // =========================
    async function openPoiFromDto(poiDto: PoiDto) {
        const reqId = ++homePoiReqRef.current;

        setHomePoiLoading(true);
        setHomePoiOpen(false);
        setHomePoiInfo(null);

        const feature = poiDtoToFeature(poiDto);
        setHomePoiFeature(feature);

        try {
            const label = pickPoiLabelFromDto(poiDto);
            if (!label) {
                if (reqId === homePoiReqRef.current) setHomePoiLoading(false);
                return;
            }

            const base = await fetchPoiInfo({
                approx: { name: label, lat: poiDto.lat, lon: poiDto.lon },
                sourceFeature: feature,
            });

            if (reqId !== homePoiReqRef.current) return;

            if (!base) {
                setHomePoiLoading(false);
                return;
            }

            let merged = uniqStrings([base.image ?? "", ...(base.images ?? [])]).slice(0, 10);

            if (merged.length < 10) {
                try {
                    const wiki10 = await searchWikimediaImagesByName(label, 10);
                    if (reqId !== homePoiReqRef.current) return;
                    merged = uniqStrings([...merged, ...(wiki10 ?? [])]).slice(0, 10);
                } catch {
                    // ignore
                }
            }

            const infoNow: PoiInfo = {
                ...base,
                image: merged[0] ?? base.image ?? null,
                images: merged,
            };

            setHomePoiInfo(infoNow);
            setHomePoiOpen(true);
        } finally {
            if (reqId === homePoiReqRef.current) setHomePoiLoading(false);
        }
    }

    useEffect(() => {
        async function handler(e: Event) {
            const ce = e as CustomEvent<{ poiId: number }>;
            const poiId = ce?.detail?.poiId;
            if (!poiId) return;

            try {
                const dto = await fetchPoiById(poiId);
                if (dto) await openPoiFromDto(dto);
            } catch (err) {
                console.error("[Home] Falha ao abrir POI por id:", err);
            }
        }

        window.addEventListener("pt:open-poi", handler as any);
        return () => window.removeEventListener("pt:open-poi", handler as any);
    }, [allPois]);

    // =========================
    //   Handler do Top search (distrito ou POI)
    // =========================
    function handlePickFromTop(item: SearchItem) {
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
    }

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
                    whenReady={onMapReadyNoArg}
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
                        <TileLayer url={WORLD_LABELS} attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>' noWrap />
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
                }}
            />
        </>
    );
}