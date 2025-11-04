// src/lib/overpass.ts
import osmtogeojson from "osmtogeojson";
import { OVERPASS_ENDPOINTS } from "@/utils/constants";

/** POST simples com retries e AbortSignal opcional */
export async function overpassQueryToGeoJSON(
    query: string,
    retries = 1,
    signal?: AbortSignal
) {
    let lastErr: any;
    for (let i = 0; i < OVERPASS_ENDPOINTS.length && retries >= 0; i++) {
        const url = OVERPASS_ENDPOINTS[i];
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                },
                body: `data=${encodeURIComponent(query)}`,
                signal,
            });
            if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
            const overpassJSON = await res.json();
            return osmtogeojson(overpassJSON) as any; // GeoJSON
        } catch (e) {
            lastErr = e;
            retries--;
            if (retries < 0 && i === OVERPASS_ENDPOINTS.length - 1) throw e;
        }
    }
    throw lastErr || new Error("Overpass failed");
}

/** Apenas nós (nodes) culturais principais */
export function buildCulturalPointsQuery(poly: string) {
    // historic + tourism (sem naturais, para reduzir ruído)
    return `
[out:json][timeout:25];
(
  node[historic~"^(castle|monument|memorial|ruins|church)$"](${poly});
  node[tourism~"^(museum|artwork|viewpoint|attraction)$"](${poly});
);
out center tags;
`;
}