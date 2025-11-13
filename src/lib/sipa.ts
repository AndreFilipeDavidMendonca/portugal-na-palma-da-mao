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
 * Chama o proxy local `/api/monumentos/resolve` e devolve o detalhe SIPA
 * baseado em nome + coordenadas.
 */
export async function fetchSipaDetail(options: {
    name?: string | null;
    lat?: number | null;
    lon?: number | null;
}): Promise<SipaDetail | null> {
    const { name, lat, lon } = options;

    if (lat == null || lon == null) {
        console.warn("[fetchSipaDetail] Falta lat/lon – não vou chamar a API");
        return null;
    }

    const params = new URLSearchParams();
    if (name) params.set("name", name);
    params.set("lat", String(lat));
    params.set("lon", String(lon));

    const url = `/api/monumentos/resolve?${params.toString()}`;
    console.log("Fetching Sipa detail:", url);

    const res = await fetch(url);

    if (!res.ok) {
        console.warn("SIPA HTTP error:", res.status, res.statusText);
        return null;
    }

    const text = await res.text();
    console.log("SIPA raw body:", text.slice(0, 300));

    try {
        const json = JSON.parse(text);
        console.log("SIPA parsed JSON:", json);
        return json as SipaDetail;
    } catch (err) {
        console.error("SIPA JSON parse error:", err);
        return null;
    }
}