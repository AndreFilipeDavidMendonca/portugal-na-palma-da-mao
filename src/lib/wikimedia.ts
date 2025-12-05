// src/lib/wikimedia.ts

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/**
 * Procura imagens no Wikimedia Commons por nome do POI/distrito.
 * Devolve uma lista de URLs (thumb ou full) sem duplicados.
 */
export async function searchWikimediaImagesByName(
    name: string,
    limit: number = 8
): Promise<string[]> {
    const query = name?.trim();
    if (!query) return [];

    const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",          // necessário para CORS no browser
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "6",    // namespace File:
        gsrlimit: String(limit),
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "1200",
    });

    const url = `${COMMONS_API}?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return [];

        const json = (await res.json()) as any;
        const pages = json?.query?.pages;
        if (!pages) return [];

        const urls: string[] = [];

        Object.values(pages).forEach((p: any) => {
            const ii = p?.imageinfo?.[0];
            const u: unknown = ii?.thumburl || ii?.url;
            if (typeof u === "string" && u) {
                urls.push(u);
            }
        });

        // remover duplicados
        return Array.from(new Set(urls));
    } catch (e) {
        console.warn("[Wikimedia] erro ao obter imagens:", e);
        return [];
    }
}

/**
 * Faz HEAD às URLs e devolve apenas as primeiras `needed`
 * que respondem com res.ok (tipicamente HTTP 200).
 */
export async function loadFirstValidImages(
    urls: string[],
    needed: number = 5
): Promise<string[]> {
    const valid: string[] = [];

    for (const url of urls) {
        try {
            const res = await fetch(url, { method: "HEAD" });
            if (res.ok) {
                valid.push(url);
            }
        } catch {
            // ignora erros (404, rede, etc.)
        }

        if (valid.length >= needed) break;
    }

    return valid;
}

export async function findDistrictGalleryImages(
    name: string,
    needed: number = 5
): Promise<string[]> {
    const query = name?.trim();
    if (!query) return [];

    try {
        // 1) procurar ficheiros no Commons pelo nome do distrito
        const commonsUrls = await searchWikimediaImagesByName(query, 12);

        if (!commonsUrls.length) return [];

        // 2) validar e limitar às primeiras `needed` URLs que respondem ok
        return await loadFirstValidImages(commonsUrls, needed);
    } catch (e) {
        console.warn("[Wikipedia] erro em findDistrictGalleryImages:", e);
        return [];
    }
}