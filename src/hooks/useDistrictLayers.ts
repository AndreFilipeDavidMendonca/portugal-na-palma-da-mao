// src/pages/district/hooks/useDistrictLayers.ts
import { useEffect, useState } from "react";
import { loadGeo } from "@/lib/geo";

type AnyGeo = any;

type Props = {
    rivers?: AnyGeo | null;
    lakes?: AnyGeo | null;
    rails?: AnyGeo | null;
    roads?: AnyGeo | null;
    peaks?: AnyGeo | null;
    places?: AnyGeo | null;
};

export function useDistrictLayers(initial: Props) {
    const [rivers, setRivers] = useState<any>(initial.rivers ?? null);
    const [lakes, setLakes] = useState<any>(initial.lakes ?? null);
    const [rails, setRails] = useState<any>(initial.rails ?? null);
    const [roads, setRoads] = useState<any>(initial.roads ?? null);
    const [peaks, setPeaks] = useState<any>(initial.peaks ?? null);
    const [places, setPlaces] = useState<any>(initial.places ?? null);

    useEffect(() => {
        const safeLoad = async (path: string, set: (v: any) => void, already: any) => {
            if (already) return;
            try {
                const gj = await loadGeo(path);
                if (gj && (gj.type === "FeatureCollection" || gj.type === "Feature")) set(gj);
                else set(null);
            } catch {
                set(null);
            }
        };

        safeLoad("/geo/rios_pt.geojson", setRivers, initial.rivers);
        safeLoad("/geo/lagos_pt.geojson", setLakes, initial.lakes);
        safeLoad("/geo/ferrovias_pt.geojson", setRails, initial.rails);
        safeLoad("/geo/estradas_pt.geojson", setRoads, initial.roads);
        safeLoad("/geo/picos_pt.geojson", setPeaks, initial.peaks);
        safeLoad("/geo/cidades_pt.geojson", setPlaces, initial.places);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { rivers, lakes, rails, roads, peaks, places };
}