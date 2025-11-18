// src/lib/sipa.ts

export type SipaDetail = {
    id?: string | null;
    slug?: string | null;

    originalName?: string | null;
    normalizedName?: string | null;

    locality?: string | null;
    district?: string | null;
    concelho?: string | null;
    freguesia?: string | null;

    lat?: number | null;
    lon?: number | null;

    shortDescription?: string | null;
    fullDescriptionHtml?: string | null;

    heritageCategory?: string | null;
    propertyType?: string | null;
    protectionStatus?: string | null;

    imageUrls?: string[] | null;
    sourceUrl?: string | null;

    // se já estiveres a mandar extraAttributes do backend:
    extraAttributes?: Record<string, string> | null;
};

/**
 * Chama o proxy local `/api/monumentos` com uma BBOX pequena
 * centrada no ponto (lat, lon) e devolve o primeiro monumento.
 *
 * A ideia:
 *  - FE já sabe o ponto (do OSM / Google).
 *  - A API devolve todos os monumentos oficiais naquela zona.
 *  - Nós escolhemos o primeiro como "match principal".
 */
export async function fetchSipaDetail(options: {
    name?: string | null; // neste momento não é usado na query, mas deixamos por compatibilidade
    lat?: number | null;
    lon?: number | null;
}): Promise<SipaDetail | null> {
    const { lat, lon } = options;

    if (lat == null || lon == null) {
        console.warn("[fetchSipaDetail] Falta lat/lon – não vou chamar a API");
        return null;
    }

    // BBOX pequena à volta do clique (~200m)
    const deltaLat = 0.002;
    const deltaLon = 0.002;

    const minX = lon - deltaLon;
    const maxX = lon + deltaLon;
    const minY = lat - deltaLat;
    const maxY = lat + deltaLat;

    const params = new URLSearchParams();
    params.set("minX", String(minX));
    params.set("minY", String(minY));
    params.set("maxX", String(maxX));
    params.set("maxY", String(maxY));
    params.set("limit", "1"); // se o backend ignorar, não faz mal

    const url = `/api/monumentos?${params.toString()}`;
    console.log("Fetching Sipa detail via BBOX:", url);

    let res: Response;
    try {
        res = await fetch(url);
    } catch (err) {
        console.warn("SIPA HTTP fetch error:", err);
        return null;
    }

    if (!res.ok) {
        console.warn("SIPA HTTP error:", res.status, res.statusText);
        return null;
    }

    const text = await res.text();
    console.log("SIPA raw body:", text.slice(0, 300));

    try {
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : [json];
        const first = arr[0] ?? null;

        console.log("SIPA parsed first JSON:", first);
        return first as SipaDetail | null;
    } catch (err) {
        console.error("SIPA JSON parse error:", err);
        return null;
    }
}