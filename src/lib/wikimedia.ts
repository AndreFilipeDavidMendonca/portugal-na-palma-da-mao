// src/lib/wikimedia.ts

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

export type CommonsImage = {
    url: string;
    width?: number;
    height?: number;
    title?: string | null;
};

const uniqStrings = (arr: string[]): string[] =>
    Array.from(new Set((arr ?? []).filter(Boolean)));

function normalize(s: string) {
    return (s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function tokensOf(s: string) {
    return normalize(s)
        .split(" ")
        .filter((t) => t.length >= 3);
}

/** match do nome no título do ficheiro (para ordenar/filtrar) */
function titleMatchScore(titleOrUrl: string, query: string) {
    const tks = tokensOf(query);
    if (!tks.length) return 0;

    const hay = normalize(titleOrUrl);
    let hits = 0;
    for (const tk of tks) if (hay.includes(tk)) hits++;

    const ratio = hits / tks.length; // 0..1

    if (ratio >= 0.85) return 7;
    if (ratio >= 0.6) return 4;
    if (ratio >= 0.34) return 1;
    return -3;
}

function penaltyScore(titleOrUrl: string) {
    const hay = ` ${normalize(titleOrUrl)} `;
    let p = 0;

    const bad = [
        " page ",
        " pagina ",
        " livro ",
        " book ",
        " scan ",
        " scanned ",
        " digitized ",
        " digitalizado ",
        " manuscript ",
        " manuscrito ",
        " document ",
        " documento ",
        " newspaper ",
        " jornal ",
        " pdf ",
        " text ",
        " texto ",
        " folio ",
        " plate ",
        " prancha ",
        " engraving ",
        " gravura ",
        " etching ",
    ];
    for (const kw of bad) if (hay.includes(kw)) p -= 6;

    if (hay.includes(" bw ") || hay.includes("black and white")) p -= 3;

    return p;
}

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

        // scans/livros
        "page",
        "pagina",
        "página",
        "book",
        "livro",
        "scan",
        "scanned",
        "digitized",
        "digitalizado",
        "manuscript",
        "manuscrito",
        "document",
        "documento",
        "newspaper",
        "jornal",
        "pdf",
        "texto",
        "text",
        "folio",
        "plate",
        "prancha",
        "engraving",
        "gravura",
        "etching",
    ];

    return imgs.filter((img) => {
        const base = (img.title || img.url).toLowerCase();
        if (base.endsWith(".svg")) return false;
        if (badKeywords.some((kw) => base.includes(kw))) return false;
        return true;
    });
}

function sortCommonsForGallery(imgs: CommonsImage[], query: string): CommonsImage[] {
    return [...imgs]
        .map((img) => {
            const w = img.width ?? 0;
            const h = img.height ?? 0;
            const isLandscape = w > 0 && h > 0 && w >= h;
            const area = w * h;

            const landscapeBonus = isLandscape ? 2 : 0;
            const sizeBonus = Math.min(area / 1_000_000, 2); // até +2

            const base = img.title || img.url;
            const match = titleMatchScore(base, query);
            const penalty = penaltyScore(base);

            return { ...img, _score: (match + penalty + landscapeBonus + sizeBonus) as number };
        })
        .sort((a: any, b: any) => (b._score ?? 0) - (a._score ?? 0));
}

/* =========================================
   1) Estratégia boa: encontrar página e puxar imagens dessa página
   ========================================= */

async function commonsSearchTopPageTitle(query: string): Promise<string | null> {
    const q = query?.trim();
    if (!q) return null;

    const trySearch = async (srsearch: string, srnamespace: string) => {
        const params = new URLSearchParams({
            action: "query",
            format: "json",
            origin: "*",
            list: "search",
            srsearch,
            srnamespace,
            srwhat: "title",   // ⭐ só título (resolve o teu caso)
            srlimit: "5",
        });

        const url = `${COMMONS_API}?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) return null;

        const json = (await res.json()) as any;
        const arr = json?.query?.search;
        if (!Array.isArray(arr) || arr.length === 0) return null;

        // preferir match mais “exato” no título
        const normQ = normalize(q);
        const best = [...arr]
            .map((it: any) => ({
                title: it?.title as string,
                score:
                    (normalize(it?.title ?? "") === normQ ? 100 : 0) +
                    titleMatchScore(it?.title ?? "", q) * 10,
            }))
            .sort((a, b) => b.score - a.score)[0];

        return typeof best?.title === "string" ? best.title : null;
    };

    // 1) Category: "Jardim das Portas do Sol" (muito comum no Commons)
    let title =
        (await trySearch(`"${q}"`, "14")) ||
        (await trySearch(`intitle:"${q}"`, "14"));

    // 2) Página normal (namespace 0)
    if (!title) {
        title =
            (await trySearch(`"${q}"`, "0")) ||
            (await trySearch(`intitle:"${q}"`, "0"));
    }

    // 3) Fallback leve (ainda em title-only)
    if (!title) {
        title = (await trySearch(q, "14")) || (await trySearch(q, "0"));
    }

    return title;
}

async function fetchImagesFromCommonsPageTitle(
    pageTitle: string,
    limit: number
): Promise<CommonsImage[]> {
    const t = pageTitle?.trim();
    if (!t) return [];

    const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        titles: t,
        generator: "images",
        gimlimit: String(Math.max(10, limit * 4)), // vem muita coisa, filtramos depois
        prop: "imageinfo",
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
            // generator=images devolve File: pages; vêm com imageinfo
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
    } catch {
        return [];
    }
}

/* =========================================
   2) Fallback: pesquisa direta por ficheiros (o que tens hoje)
   ========================================= */

async function searchCommonsImagesDetailedByFileSearch(
    query: string,
    limit: number
): Promise<CommonsImage[]> {
    const q = query?.trim();
    if (!q) return [];

    const params = new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        generator: "search",
        gsrsearch: q,
        gsrnamespace: "6", // File:
        gsrlimit: String(limit),
        prop: "imageinfo",
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
    } catch {
        return [];
    }
}

/* =========================================
   Orquestrador low-level (novo)
   ========================================= */

async function searchCommonsImagesDetailed(query: string, limit: number = 12): Promise<CommonsImage[]> {
    const q = query?.trim();
    if (!q) return [];

    // 1) tenta “página” e imagens dessa página (muito mais relevante)
    const pageTitle =
        (await commonsSearchTopPageTitle(q)) ||
        (await commonsSearchTopPageTitle(`${q} Lisboa`)) ||
        (await commonsSearchTopPageTitle(`${q} Portugal`));

    if (pageTitle) {
        const fromPage = await fetchImagesFromCommonsPageTitle(pageTitle, limit);
        const cleaned = filterBadCommonsImages(fromPage);
        const ordered = sortCommonsForGallery(cleaned, q);
        return ordered.slice(0, Math.max(limit, 8));
    }

    // 2) fallback: pesquisa por ficheiros
    const fromSearch = await searchCommonsImagesDetailedByFileSearch(q, Math.max(limit * 4, 24));
    const cleaned = filterBadCommonsImages(fromSearch);
    const ordered = sortCommonsForGallery(cleaned, q);
    return ordered.slice(0, Math.max(limit, 8));
}

/* =========================================
   API pública (igual)
   ========================================= */

export async function searchWikimediaImagesByName(name: string, limit: number = 8): Promise<string[]> {
    const detailed = await searchCommonsImagesDetailed(name, limit);
    return uniqStrings(detailed.map((d) => d.url)).slice(0, limit);
}

export async function loadFirstValidImages(urls: string[], needed: number = 5): Promise<string[]> {
    const valid: string[] = [];
    for (const url of urls) {
        try {
            const res = await fetch(url, { method: "HEAD" });
            if (res.ok) valid.push(url);
        } catch {}
        if (valid.length >= needed) break;
    }
    return valid;
}

export async function getDistrictCommonsGallery(name: string, maxPhotos: number = 10): Promise<string[]> {
    const q = name?.trim();
    if (!q) return [];

    const all: CommonsImage[] = [];
    const addQuery = async (term: string, lim: number) => {
        const imgs = await searchCommonsImagesDetailed(term, lim);
        all.push(...imgs);
    };

    await addQuery(q, 20);
    await addQuery(`${q} Portugal`, 15);
    await addQuery(`Distrito de ${q}`, 15);

    const filtered = filterBadCommonsImages(all);
    const ordered = sortCommonsForGallery(filtered, q);
    const candidateUrls = uniqStrings(ordered.map((i) => i.url));

    return loadFirstValidImages(candidateUrls, maxPhotos);
}

export async function findDistrictGalleryImages(name: string, needed: number = 5): Promise<string[]> {
    return getDistrictCommonsGallery(name, needed);
}