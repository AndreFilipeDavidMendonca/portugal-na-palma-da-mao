const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

type CommonsImage = {
    url: string;
    width?: number;
    height?: number;
    title?: string | null;
};

/** Util simples para tirar duplicados e falsy */
const uniqStrings = (arr: string[]): string[] =>
    Array.from(new Set(arr.filter(Boolean)));

/**
 * Chamada "low-level": vai ao Commons e devolve objetos com url + dimensões.
 * Usa generator=search no namespace File: (6).
 */
async function searchCommonsImagesDetailed(
    query: string,
    limit: number = 12
): Promise<CommonsImage[]> {
    const q = query?.trim();
    if (!q) return [];

    const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*", // CORS
        generator: "search",
        gsrsearch: q,
        gsrnamespace: "6", // File:
        gsrlimit: String(limit),
        prop: "imageinfo",
        // pedimos também o size para saber width/height
        iiprop: "url|size",
        iiurlwidth: "1600",
    });

    const url = `${COMMONS_API}?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return [];

        const json = (await res.json()) as any;
        const pages = json?.query?.pages;
        if (!pages) return [];

        const imgs: CommonsImage[] = [];

        Object.values(pages).forEach((p: any) => {
            const ii = p?.imageinfo?.[0];
            const u: unknown = ii?.thumburl || ii?.url;
            if (typeof u === "string" && u) {
                imgs.push({
                    url: u,
                    width: typeof ii?.width === "number" ? ii.width : undefined,
                    height: typeof ii?.height === "number" ? ii.height : undefined,
                    title: typeof p?.title === "string" ? p.title : null,
                });
            }
        });

        return imgs;
    } catch (e) {
        console.warn("[Wikimedia] erro em searchCommonsImagesDetailed:", e);
        return [];
    }
}

/**
 * Filtro para tirar brasões, bandeiras, mapas, logos, SVG, etc,
 * que visualmente não ficam bem na galeria de distritos.
 */
function filterBadCommonsImages(imgs: CommonsImage[]): CommonsImage[] {
    const badKeywords = [
        "coat of arms",
        "brasão",
        "escudo",
        "bandeira",
        "flag",
        "logo",
        "logotipo",
        "symbol",
        "símbolo",
        "seal",
        "brasao",
        "map",
        "mapa",
        "locator",
        "outline",
    ];

    return imgs.filter((img) => {
        const base = (img.title || img.url).toLowerCase();

        // tira SVG quase sempre icónico
        if (base.endsWith(".svg")) return false;

        if (badKeywords.some((kw) => base.includes(kw))) return false;

        return true;
    });
}

/**
 * Dá uma pontuação aos ficheiros para ordenar:
 *  - prefere landscape (largura >= altura)
 *  - prefere imagens maiores
 */
function sortCommonsForGallery(imgs: CommonsImage[]): CommonsImage[] {
    return [...imgs]
        .map((img) => {
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            const isLandscape = w > 0 && h > 0 && w >= h;
            const area = w * h;

            const landscapeBonus = isLandscape ? 3 : 0;
            const sizeBonus = Math.min(area / 1_000_000, 3); // até +3

            const score = landscapeBonus + sizeBonus;

            return { ...img, _score: score as number };
        })
        .sort((a: any, b: any) => (b._score ?? 0) - (a._score ?? 0));
}

/**
 * Versão simples (retro-compatível): devolve só URLs.
 * Usa searchCommonsImagesDetailed internamente.
 */
export async function searchWikimediaImagesByName(
    name: string,
    limit: number = 8
): Promise<string[]> {
    const detailed = await searchCommonsImagesDetailed(name, limit);
    return uniqStrings(detailed.map((d) => d.url));
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

/**
 * Helper "alto nível" para distritos:
 *  - faz várias pesquisas no Commons (nome simples, +Portugal, etc.)
 *  - junta resultados, remove duplicados
 *  - filtra brasões/flags/logos/mapas/SVG
 *  - ordena por landscape e tamanho
 *  - faz HEAD e devolve no máximo `maxPhotos` válidas
 */
export async function getDistrictCommonsGallery(
    name: string,
    maxPhotos: number = 10
): Promise<string[]> {
    const q = name?.trim();
    if (!q) return [];

    try {
        const all: CommonsImage[] = [];

        const addQuery = async (term: string, limit: number) => {
            if (!term) return;
            const imgs = await searchCommonsImagesDetailed(term, limit);
            all.push(...imgs);
        };

        // várias variantes para tentar apanhar mais fotos boas
        await addQuery(q, 40);
        await addQuery(`${q} Portugal`, 30);
        await addQuery(`Distrito de ${q}`, 30);
        await addQuery(`${q} district Portugal`, 30);

        if (!all.length) return [];

        const filtered = filterBadCommonsImages(all);
        const ordered = sortCommonsForGallery(filtered);

        const candidateUrls = uniqStrings(ordered.map((i) => i.url));

        // devolve no máximo `maxPhotos` já validadas por HEAD
        return await loadFirstValidImages(candidateUrls, maxPhotos);
    } catch (e) {
        console.warn("[Wikimedia] erro em getDistrictCommonsGallery:", e);
        return [];
    }
}

/**
 * Alias mais antigo – mantemos por compatibilidade.
 * Internamente passa a usar o getDistrictCommonsGallery.
 */
export async function findDistrictGalleryImages(
    name: string,
    needed: number = 5
): Promise<string[]> {
    return getDistrictCommonsGallery(name, needed);
}