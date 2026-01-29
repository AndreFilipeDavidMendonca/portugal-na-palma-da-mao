
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { loadGeo } from "@/lib/geo";
import {
    fetchCurrentUser,
    fetchDistricts,
    fetchPois,
    type CurrentUserDto,
    type DistrictDto,
    type PoiDto,
} from "@/lib/api";

type AnyGeo = any;

export function useHomeData() {
    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    const [districtDtos, setDistrictDtos] = useState<DistrictDto[]>([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    const [allPois, setAllPois] = useState<PoiDto[]>([]);
    const [loadingAllPois, setLoadingAllPois] = useState(false);

    const [currentUser, setCurrentUser] = useState<CurrentUserDto | null>(null);

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

    useEffect(() => {
        let aborted = false;
        Promise.all([
            loadGeo("/geo/portugal.geojson"),
            loadGeo("/geo/distritos.geojson").catch(() => null),
        ])
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
            .catch((e) => console.error("[api] Falha a carregar POIs:", e))
            .finally(() => alive && setLoadingAllPois(false));
        return () => {
            alive = false;
        };
    }, []);

    return {
        ptGeo,
        districtsGeo,
        districtDtos,
        allPois,
        loadingDistricts,
        loadingAllPois,
        currentUser,
        isAdmin,
    };
}

export const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);