// src/lib/overpass.ts
import osmtogeojson from "osmtogeojson";
import { OVERPASS_ENDPOINTS, CULTURAL_NODE_TAGS } from "@/utils/constants";

// Build a poly:"lat lon ..." from a polygon/multipolygon (lng,lat → lat lon)
export function featureToOverpassPoly(feature: any): string | null {
    const g = feature?.geometry || feature;
    if (!g) return null;

    const outerRings: number[][][] =
        g.type === "Polygon"
            ? [g.coordinates[0]]
            : g.type === "MultiPolygon"
                ? g.coordinates.map((poly: number[][][]) => poly[0])
                : [];

    if (!outerRings.length) return null;

    const pts: string[] = [];
    for (const ring of outerRings) {
        for (const [lng, lat] of ring) pts.push(`${lat} ${lng}`);
    }
    return `poly:"${pts.join(" ")}"`;
}

// Compose the reduced “cultural” points query (historic + tourism)
export function buildCulturalPointsQuery(poly: string): string {
    // Partition the list by tag key expected by OSM:
    const historicVals = ["castle","monument","memorial","ruins","church"];
    const tourismVals  = ["museum","artwork","viewpoint","attraction"];

    const historicRe = historicVals.join("|");
    const tourismRe  = tourismVals.join("|");

    return `
    [out:json][timeout:25];
    (
      node[historic~"^(${historicRe})$"](${poly});
      node[tourism~"^(${tourismRe})$"](${poly});
    );
    out center tags;
  `;
}

// POST to Overpass with fallback endpoints + optional retries and AbortSignal
export async function overpassQueryToGeoJSON(
    query: string,
    retries = 0,
    signal?: AbortSignal
): Promise<any> {
    let lastErr: any;
    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: `data=${encodeURIComponent(query)}`,
                signal,
            });
            if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
            const overpassJSON = await res.json();
            return osmtogeojson(overpassJSON);
        } catch (e) {
            lastErr = e;
        }
    }
    // simple retry loop
    if (retries > 0) {
        await new Promise(r => setTimeout(r, 800));
        return overpassQueryToGeoJSON(query, retries - 1, signal);
    }
    throw lastErr ?? new Error("Overpass request failed");
}

export async function fetchDistrictBasemap(poly: string, signal?: AbortSignal) {
    // Rios
    const riversQ = `
    [out:json][timeout:25];
    (
      way[waterway~"^(river|stream)$"](${poly});
      relation[waterway=river](${poly});
    );
    out body tags; >; out skel qt;
  `;

    // Lagos / albufeiras / água
    const lakesQ = `
    [out:json][timeout:25];
    (
      way[natural=water](${poly});
      relation[natural=water](${poly});
    );
    out body tags; >; out skel qt;
  `;

    // Linhas férreas
    const railQ = `
    [out:json][timeout:25];
    (
      way[railway~"^(rail|light_rail|subway)$"](${poly});
      relation[railway=rail](${poly});
    );
    out body tags; >; out skel qt;
  `;

    // Estradas “gordas” (para não poluir)
    const roadsQ = `
    [out:json][timeout:25];
    (
      way[highway~"^(motorway|trunk|primary)$"](${poly});
    );
    out body tags; >; out skel qt;
  `;

    // Montanhas/picos
    const peaksQ = `
    [out:json][timeout:25];
    (
      node[natural=peak](${poly});
    );
    out center tags;
  `;

    // Cidades/vilas (toponímia principal)
    const placesQ = `
    [out:json][timeout:25];
    (
      node[place~"^(city|town|village)$"](${poly});
    );
    out center tags;
  `;

    const [rivers, lakes, rail, roads, peaks, places] = await Promise.all([
        overpassQueryToGeoJSON(riversQ, 2, signal),
        overpassQueryToGeoJSON(lakesQ, 2, signal),
        overpassQueryToGeoJSON(railQ,  2, signal),
        overpassQueryToGeoJSON(roadsQ, 2, signal),
        overpassQueryToGeoJSON(peaksQ, 2, signal),
        overpassQueryToGeoJSON(placesQ,2, signal),
    ]);

    return { rivers, lakes, rail, roads, peaks, places };
}