import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { loadGeo } from "@/lib/geo";
import { useAuth } from "@/auth/AuthContext";

type AnyGeo = any;

export function useHomeData() {
    const { user } = useAuth();

    const [ptGeo, setPtGeo] = useState<AnyGeo | null>(null);
    const [districtsGeo, setDistrictsGeo] = useState<AnyGeo | null>(null);

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

    return {
        ptGeo,
        districtsGeo,
        currentUser: user,
        isAdmin,
    };
}

export const WORLD_BOUNDS = L.latLngBounds([-85.05112878, -180], [85.05112878, 180]);