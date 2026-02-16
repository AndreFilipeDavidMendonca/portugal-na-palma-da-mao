import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { loadGeo } from "@/lib/geo";
import { fetchDistricts, fetchPois, type DistrictDto, type PoiDto } from "@/lib/api";
import {useAuth} from "@/auth/AuthContext";

type AnyGeo = any;

export function useHomeData() {
    const { user } = useAuth();

    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

    const [districtDtos, setDistrictDtos] = useState<DistrictDto[]>([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    const [allPois, setAllPois] = useState<PoiDto[]>([]);
    const [loadingAllPois, setLoadingAllPois] = useState(false);

    const isAdmin = useMemo(() => user?.role?.toLowerCase() === "admin", [user]);

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

        // agora vem do AuthProvider
        currentUser: user,
        isAdmin,
    };
}

export const WORLD_BOUNDS = L.latLngBounds(
    [-85.05112878, -180],
    [85.05112878, 180]
);