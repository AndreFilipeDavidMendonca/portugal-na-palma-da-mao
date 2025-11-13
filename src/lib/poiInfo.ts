// src/lib/poiInfo.ts
// -------------------------------------------------------------------
// Google:
//   - nome, coords, fotos, horários, rating, website
//   - para miradouros (viewpoints): toda a info vem de Google (sem Wikipédia)
//
// Wikipédia:
//   - descrição, história, arquitetura
//   - usada apenas para POIs que NÃO são miradouro
//
// OSM:
//   - pode fornecer "nome anterior" e contactos (phone/email/website)
// -------------------------------------------------------------------

import {
    getPlaceDetailsById,
    photoUrlsFromPlace,
    findPlaceByNameAndPoint,
} from "@/lib/gplaces";
import { compactOpeningHours } from "@/utils/openingHours";
import {fetchSipaDetail} from "@/lib/sipa";

/* =====================================================================
   TIPOS
   ===================================================================== */

export type OpeningHours = {
    raw?: string | null;
    isOpenNow?: boolean;
    nextChange?: string | null;
};

export type Contacts = {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
};

export type Ratings = {
    source: "google";
    value: number;
    votes?: number | null;
};

export type BuiltPeriod = {
    start?: string | null;
    end?: string | null;
    opened?: string | null;
};

export type PoiInfo = {
    label?: string | null;
    description?: string | null;
    image?: string | null;
    images?: string[];
    inception?: string | null;

    wikipediaUrl?: string | null;
    wikidataId?: string | null;

    oldNames?: string[];

    coords?: { lat: number; lon: number } | null;
    website?: string | null;

    instanceOf?: string[];
    locatedIn?: string[];
    heritage?: string[];
    kinds?: string | null;

    openingHours?: OpeningHours | null;
    contacts?: Contacts | null;
    ratings?: Ratings[];

    historyText?: string | null;
    architectureText?: string | null;

    architects?: string[];
    architectureStyles?: string[];
    materials?: string[];
    builders?: string[];
    builtPeriod?: BuiltPeriod;
};

/* =====================================================================
   HELPERS BÁSICOS (texto / JSON / distância)
   ===================================================================== */

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

const normalizeText = (value?: string | null) =>
    (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

/** overlap simples de tokens entre dois textos */
async function safeJson(url: string) {
    const response = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

function htmlToPlainText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const paragraphs = Array.from(doc.querySelectorAll("p"));
    return paragraphs
        .map((p) => p.textContent?.trim() || "")
        .filter(Boolean)
        .join("\n\n");
}

function distanceKm(
    a?: { lat: number; lon: number } | null,
    b?: { lat: number; lon: number } | null
): number {
    if (!a || !b) return Infinity;
    const R = 6371; // km
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const sin1 = Math.sin(dLat / 2);
    const sin2 = Math.sin(dLon / 2);
    const x = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

/** Gera nomes de busca para o Google, com variações especiais para miradouros */
function buildGoogleSearchNames(
    approximateName: string,
    isViewpoint: boolean,
    sourceFeature?: any | null
): string[] {
    const names: string[] = [];
    const base = approximateName.trim();
    if (!base) return [];

    // Nome tal como vem do OSM
    names.push(base);

    if (!isViewpoint) {
        return Array.from(new Set(names));
    }

    // Para miradouros: tentar remover o prefixo "Miradouro ..."
    const withoutPrefix = base
        .replace(/^miradouro\s+(do|da|de|dos|das)\s+/i, "")
        .replace(/^miradouro\s+/i, "")
        .trim();

    if (withoutPrefix && withoutPrefix.toLowerCase() !== base.toLowerCase()) {
        names.push(withoutPrefix);
    }

    // Tentar descobrir uma “zona” (cidade / vila) a partir dos tags OSM
    const props = sourceFeature?.properties ?? {};
    const tags = props.tags ?? {};

    const zoneCandidate =
        tags["addr:city"] ??
        tags["is_in:city"] ??
        tags["addr:municipality"] ??
        tags["addr:place"] ??
        tags["addr:town"] ??
        tags["addr:village"] ??
        null;

    if (zoneCandidate && typeof zoneCandidate === "string") {
        const zone = zoneCandidate.trim();
        if (zone) {
            if (withoutPrefix) {
                names.push(`${withoutPrefix} ${zone}`);            // "Portas do Sol Santarém"
                names.push(`Miradouro ${withoutPrefix} ${zone}`);  // "Miradouro Portas do Sol Santarém"
            }
            names.push(`${base} ${zone}`);                         // "Miradouro das Portas do Sol Santarém"
            names.push(`${base} ${zone} Portugal`);
        }
    }

    return Array.from(new Set(names.filter(Boolean)));
}

const BAD_VIEWPOINT_TYPES = new Set([
    "cafe",
    "restaurant",
    "bar",
    "night_club",
    "bakery",
    "meal_takeaway",
    "meal_delivery",
    "lodging",
    "hotel",
    "motel",
    "campground",
    "store",
    "supermarket",
    "grocery_or_supermarket",
    "shopping_mall",
    "convenience_store",
    "parking",
    "parking_lot",
    "gas_station",
    "car_rental",
    "car_dealer",
    "ticket_agency",
    "travel_agency",
    "real_estate_agency"
]);

function isBadViewpointPlace(place: any): boolean {
    const types: string[] = place?.types || [];
    return types.some((t) => BAD_VIEWPOINT_TYPES.has(t));
}

/* =====================================================================
   WIKIPEDIA ENDPOINT BUILDERS
   ===================================================================== */

const WIKIPEDIA_SUMMARY = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

const WIKIPEDIA_SEARCH = (lang: string, query: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
    )}&format=json&origin=*`;

const WIKIPEDIA_GEOSEARCH = (lang: string, lat: number, lon: number, radius = 800) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=20&format=json&origin=*`;

const WIKIPEDIA_PARSE = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
        title
    )}&prop=sections|text&format=json&origin=*`;

/* =====================================================================
   TIPOS / HELPERS WIKIPEDIA
   ===================================================================== */

export type WikipediaTag = { lang: string; title: string };


/** usa /page/summary + valida a distância às coords aproximadas */
export async function fetchFromWikipediaStrict(
    lang: string,
    title: string,
    approxCoords?: { lat: number; lon: number } | null,
    maxDistanceKm = 60
): Promise<Partial<PoiInfo>> {
    const json = await safeJson(WIKIPEDIA_SUMMARY(lang, title));

    const wLat = json?.coordinates?.lat;
    const wLon = json?.coordinates?.lon;
    const wikiCoords =
        typeof wLat === "number" && typeof wLon === "number"
            ? { lat: wLat, lon: wLon }
            : null;

    if (approxCoords && wikiCoords) {
        const distance = distanceKm(approxCoords, wikiCoords);
        if (distance > maxDistanceKm) return {};
    }

    return {
        label: json?.title ?? null,
        description: json?.extract ?? null,
        wikipediaUrl: json?.content_urls?.desktop?.page ?? null,
        coords: wikiCoords ?? null,
    };
}

/** devolve texto de secções "História" / "Arquitetura" (PT ou EN) */
export async function fetchWikipediaSections(
    lang: string,
    title: string
): Promise<{ history?: string | null; architecture?: string | null }> {
    const fetchLanguage = async (lng: string) => {
        try {
            const json = await safeJson(WIKIPEDIA_PARSE(lng, title));
            const html = json?.parse?.text?.["*"];
            if (!html) return { history: null, architecture: null };

            const doc = new DOMParser().parseFromString(html, "text/html");
            const sections: Record<string, string> = {};
            let currentKey = "";
            const nodes = Array.from(doc.body.childNodes);

            const appendSection = (key: string, value: string) => {
                sections[key] = (sections[key] || "") + value;
            };

            for (const node of nodes) {
                if ((node as HTMLElement).nodeType === 1) {
                    const el = node as HTMLElement;

                    if (/^H[2-4]$/.test(el.tagName)) {
                        currentKey = (el.textContent || "").trim().toLowerCase();
                        continue;
                    }

                    if (
                        currentKey &&
                        (el.tagName === "P" || el.tagName === "UL" || el.tagName === "OL")
                    ) {
                        appendSection(currentKey, el.outerHTML);
                    }
                }
            }

            const extractFirstParagraphs = (keys: string[]) => {
                for (const key of keys) {
                    const entry = Object.entries(sections).find(([header]) =>
                        header.includes(key)
                    );
                    if (entry) {
                        const text = htmlToPlainText(entry[1]).trim();
                        if (text) return text;
                    }
                }
                return null;
            };

            const history = extractFirstParagraphs(["história", "history"]);
            const architecture = extractFirstParagraphs(["arquitetura", "architecture"]);
            return { history, architecture };
        } catch {
            return { history: null, architecture: null };
        }
    };

    const primary = await fetchLanguage(lang);
    if (primary.history || primary.architecture) return primary;

    return await fetchLanguage("en");
}

export async function searchWikipediaTitleByName(
    name: string,
    lang: string = "pt"
): Promise<WikipediaTag | null> {
    try {
        const json = await safeJson(WIKIPEDIA_SEARCH(lang, name));
        const firstResult = json?.query?.search?.[0];
        if (!firstResult) return null;
        return { lang, title: firstResult.title as string };
    } catch {
        return null;
    }
}

export async function geosearchWikipediaTitleSmart(
    lat: number,
    lon: number,
    name?: string,
    lang: string = "pt"
): Promise<WikipediaTag | null> {
    try {
        const json = await safeJson(WIKIPEDIA_GEOSEARCH(lang, lat, lon, 800));
        const items: Array<{ title: string; dist?: number }> = json?.query?.geosearch ?? [];
        if (!items.length) return null;

        const normalize = (v: string) =>
            v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const queryNorm = normalize(name ?? "");

        const bestMatch =
            items.find((item) =>
                queryNorm ? normalize(item.title).includes(queryNorm.split(" ")[0]) : false
            ) ?? items[0];

        return bestMatch ? { lang, title: bestMatch.title } : null;
    } catch {
        return null;
    }
}

/** tenta converter (lang,title) para o título PT se existir */
async function resolvePortugueseTitleViaLanglinks(
    fromLang: string,
    fromTitle: string
): Promise<string | null> {
    try {
        const api = `https://${fromLang}.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=pt&format=json&titles=${encodeURIComponent(
            fromTitle
        )}&origin=*`;
        const json = await safeJson(api);
        const pages = json?.query?.pages || {};
        const firstPage = Object.values(pages)[0] as any;
        const langLink = firstPage?.langlinks?.[0];
        return langLink?.["*"] || null;
    } catch {
        return null;
    }
}

/** tenta obter título PT via Wikidata sitelinks */
async function resolvePortugueseTitleViaWikidata(
    fromLang: string,
    fromTitle: string
): Promise<string | null> {
    try {
        const api1 = `https://${fromLang}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&format=json&titles=${encodeURIComponent(
            fromTitle
        )}&origin=*`;
        const json1 = await safeJson(api1);
        const pages = json1?.query?.pages || {};
        const firstPage = Object.values(pages)[0] as any;
        const qid = firstPage?.pageprops?.wikibase_item;
        if (!qid) return null;

        const api2 = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
        const json2 = await safeJson(api2);
        const entity = json2?.entities?.[qid];
        const ptTitle = entity?.sitelinks?.ptwiki?.title;
        return typeof ptTitle === "string" ? ptTitle : null;
    } catch {
        return null;
    }
}

/** se existir versão PT, devolve {lang:"pt",title}, senão devolve a tag original */
async function ensurePortugueseTitle(
    tag: { lang: string; title: string } | null
): Promise<{ lang: string; title: string } | null> {
    if (!tag) return null;
    if (tag.lang === "pt") return tag;

    const viaLanglinks = await resolvePortugueseTitleViaLanglinks(tag.lang, tag.title);
    if (viaLanglinks) return { lang: "pt", title: viaLanglinks };

    const viaWikidata = await resolvePortugueseTitleViaWikidata(tag.lang, tag.title);
    if (viaWikidata) return { lang: "pt", title: viaWikidata };

    return tag;
}

/* =====================================================================
   OSM HELPERS (nome principal)
   ===================================================================== */

function featurePrimaryName(feature?: any | null): string | null {
    if (!feature) return null;
    const props = feature.properties ?? {};
    const tags = props.tags ?? {};

    return (
        props["name:pt"] ||
        props.name ||
        props["name:en"] ||
        tags["name:pt"] ||
        tags.name ||
        tags["name:en"] ||
        null
    );
}

/* =====================================================================
   GOOGLE PLACES HELPER: textSearch/nearbySearch fallback
   ===================================================================== */


/* =====================================================================
   MERGE HELPERS (Contacts / PoiInfo)
   ===================================================================== */

function mergeContacts(existing?: Contacts | null, incoming?: Contacts | null): Contacts | undefined {
    if (!existing && !incoming) return undefined;

    return {
        phone: (incoming?.phone ?? existing?.phone) ?? undefined,
        email: (incoming?.email ?? existing?.email) ?? undefined,
        website: (incoming?.website ?? existing?.website) ?? undefined,
    };
}

function mergePoiPieces(current: Partial<PoiInfo>, incoming: Partial<PoiInfo>): Partial<PoiInfo> {
    const result: Partial<PoiInfo> = { ...current };

    const choose = <T,>(next: T | null | undefined, prev: T | null | undefined): T | undefined =>
        next === 0 ||
        next === false ||
        (Array.isArray(next) && next.length > 0) ||
        (!!next && next !== "")
            ? (next as any)
            : (prev as any);

    result.label = current.label ?? incoming.label ?? result.label ?? null;

    result.description = choose(incoming.description, current.description) ?? result.description;
    result.image = choose(incoming.image, current.image) ?? result.image;

    result.images = incoming.images?.length
        ? uniq([...(current.images ?? []), ...incoming.images])
        : current.images ?? result.images;

    result.wikipediaUrl =
        current.wikipediaUrl ?? incoming.wikipediaUrl ?? result.wikipediaUrl ?? null;

    result.coords = current.coords ?? incoming.coords ?? result.coords ?? null;
    result.website = current.website ?? incoming.website ?? result.website ?? null;

    result.openingHours =
        incoming.openingHours ?? current.openingHours ?? result.openingHours ?? null;

    result.ratings = incoming.ratings ?? current.ratings ?? result.ratings;

    result.historyText =
        choose(incoming.historyText, current.historyText) ?? result.historyText;
    result.architectureText =
        choose(incoming.architectureText, current.architectureText) ??
        result.architectureText;

    // ⬇️ novo: herança / classificação
    if (incoming.heritage && incoming.heritage.length) {
        result.heritage = uniq([...(current.heritage ?? []), ...incoming.heritage]);
    } else if (current.heritage && current.heritage.length) {
        result.heritage = current.heritage;
    }

    return result;
}

/* =====================================================================
   ORQUESTRADOR: fetchPoiInfo
   ===================================================================== */

export async function fetchPoiInfo(options: {
    wikipedia?: string | null;
    approx?: { name?: string | null; lat?: number | null; lon?: number | null } | null;
    sourceFeature?: any | null;
}): Promise<PoiInfo | null> {
    let merged: Partial<PoiInfo> = { images: [] };

    const approximateName = options.approx?.name ?? null;
    const approximateLat = options.approx?.lat ?? null;
    const approximateLon = options.approx?.lon ?? null;
    const approximateCoords =
        approximateLat != null && approximateLon != null
            ? { lat: approximateLat, lon: approximateLon }
            : null;

    const sourceFeature = options.sourceFeature || null;
    const poiCategory: string | null = sourceFeature?.properties?.__cat ?? null;
    const isViewpoint = poiCategory === "viewpoint";

    /* -------------------------------------------------------
       1) GOOGLE — nome oficial, coords, fotos, horário, rating
          (e única fonte para miradouros)
       ------------------------------------------------------- */
    try {
        if (approximateName && approximateCoords) {
            const searchNames = buildGoogleSearchNames(
                approximateName,
                isViewpoint,
                sourceFeature
            );

            for (const searchName of searchNames) {
                const candidate = await findPlaceByNameAndPoint(
                    searchName,
                    approximateCoords.lat!,
                    approximateCoords.lon!,
                    isViewpoint ? 400 : 1000
                );

                if (!candidate?.place_id) {
                    continue;
                }

                const details = await getPlaceDetailsById(candidate.place_id);
                if (!details) continue;

                // rejeitar cafés/restaurantes/etc. para miradouros
                if (isViewpoint && isBadViewpointPlace(details)) {
                    continue;
                }

                const candidateCoords = {
                    lat: candidate.lat,
                    lon: candidate.lng,
                };

                const dist = distanceKm(approximateCoords, candidateCoords);
                const maxAllowedKm = isViewpoint ? 8 : 60;

                if (dist > maxAllowedKm) {
                    continue;
                }

                const resolvedName =
                    (details as any).displayName?.text ||
                    (details as any).name ||
                    candidate.name ||
                    approximateName ||
                    null;

                const website =
                    (details as any).websiteUri ??
                    (details as any).website ??
                    (details as any).websiteUrl ??
                    undefined;

                const ratingValue =
                    typeof (details as any).rating === "number"
                        ? (details as any).rating
                        : undefined;

                const ratingCount =
                    typeof (details as any).userRatingCount === "number"
                        ? (details as any).userRatingCount
                        : typeof (details as any).user_ratings_total === "number"
                            ? (details as any).user_ratings_total
                            : null;

                const googleOpeningText: string[] | undefined =
                    (details as any).opening_hours?.weekday_text;

                const compactOpening =
                    googleOpeningText && googleOpeningText.length
                        ? compactOpeningHours(googleOpeningText)
                        : undefined;

                const openingHours =
                    (details as any).opening_hours
                        ? {
                            raw:
                                typeof compactOpening === "string"
                                    ? compactOpening
                                    : Array.isArray(compactOpening)
                                        ? JSON.stringify(compactOpening)
                                        : undefined,
                            isOpenNow:
                                typeof (details as any).opening_hours.isOpen === "function"
                                    ? !!(details as any).opening_hours.isOpen()
                                    : undefined,
                        }
                        : undefined;

                const googlePhotos = photoUrlsFromPlace(details, 1600);

                const googleDescription: string | undefined =
                    (details as any).editorialSummary?.text ??
                    (details as any).editorial_summary?.overview ??
                    undefined;

                merged = mergePoiPieces(merged, {
                    label: resolvedName,
                    coords: candidateCoords,
                    website,
                    openingHours,
                    ratings:
                        typeof ratingValue === "number"
                            ? [
                                {
                                    source: "google",
                                    value: Math.max(0, Math.min(5, ratingValue)),
                                    votes: ratingCount,
                                },
                            ]
                            : undefined,
                    image: googlePhotos[0],
                    images: googlePhotos.slice(1),
                    description: googleDescription ?? merged.description,
                });

                // já temos um bom candidato → não precisamos de tentar outros nomes
                break;
            }
        }
    } catch (error) {
        console.warn("Google resolver falhou:", error);
    }

    const baseName = merged.label ?? approximateName ?? null;
    const baseCoords = merged.coords ?? approximateCoords ?? null;

    /* -------------------------------------------------------
       2) SIPA — detalhe oficial (descrição, classificação, fotos)
       ------------------------------------------------------- */
    if (baseCoords) {
        try {
            const sipa = await fetchSipaDetail({
                name: baseName,
                lat: baseCoords.lat,
                lon: baseCoords.lon,
            });

            console.log("SIPA:", sipa);
            if (sipa) {
                const plainHtml =
                    (sipa as any).fullDescriptionHtml
                        ? htmlToPlainText((sipa as any).fullDescriptionHtml)
                        : undefined;

                merged = mergePoiPieces(merged, {
                    // se o SIPA tiver nome, pode refinar o label
                    label: (sipa as any).originalName ?? merged.label,

                    // descrição oficial tem prioridade sobre Wikipedia
                    description:
                        (sipa as any).shortDescription ?? plainHtml ?? merged.description,

                    image:
                        (sipa as any).imageUrls?.[0] ??
                        merged.image,
                    images: (sipa as any).imageUrls ?? merged.images,

                    // mapeamos classificação para heritage[]
                    heritage: [
                        ...(merged.heritage ?? []),
                        ...(((sipa as any).heritageCategory
                            ? [(sipa as any).heritageCategory]
                            : []) as string[]),
                        ...(((sipa as any).protectionStatus
                            ? [(sipa as any).protectionStatus]
                            : []) as string[]),
                    ],
                });
            }
        } catch (error) {
            console.warn("SIPA resolver falhou:", error);
        }
    }

    /* -------------------------------------------------------
       3) WIKIPEDIA — texto (exceto para viewpoints)
       ------------------------------------------------------- */
    let wikiTag: { lang: string; title: string } | null = null;

    if (!isViewpoint) {
        if (baseName) {
            const byNamePt = await searchWikipediaTitleByName(baseName, "pt");
            if (byNamePt) wikiTag = byNamePt;
        }

        if (!wikiTag && baseCoords) {
            const nearPt = await geosearchWikipediaTitleSmart(
                baseCoords.lat,
                baseCoords.lon,
                baseName ?? undefined,
                "pt"
            );
            if (nearPt) wikiTag = nearPt;
        }

        if (wikiTag) {
            try {
                let wikiSummary = await fetchFromWikipediaStrict(
                    wikiTag.lang,
                    wikiTag.title,
                    baseCoords,
                    60
                );

                if (
                    (!wikiSummary || !Object.keys(wikiSummary).length) &&
                    wikiTag.lang !== "pt"
                ) {
                    const forcedPt = await ensurePortugueseTitle(wikiTag);
                    if (forcedPt?.lang === "pt") {
                        wikiTag = forcedPt;
                        wikiSummary = await fetchFromWikipediaStrict(
                            wikiTag.lang,
                            wikiTag.title,
                            baseCoords,
                            60
                        );
                    }
                }

                if (wikiSummary && Object.keys(wikiSummary).length) {
                    merged = mergePoiPieces(merged, {
                        description: wikiSummary.description ?? undefined,
                        wikipediaUrl: (wikiSummary as any).wikipediaUrl ?? undefined,
                    });

                    const sections = await fetchWikipediaSections(
                        wikiTag.lang,
                        wikiTag.title
                    );
                    merged = mergePoiPieces(merged, {
                        historyText: sections.history ?? undefined,
                        architectureText: sections.architecture ?? undefined,
                    });

                    if (!sections.history && !sections.architecture) {
                        const enSections = await fetchWikipediaSections(
                            "en",
                            wikiTag.title
                        );
                        merged = mergePoiPieces(merged, {
                            historyText:
                                merged.historyText ?? enSections.history ?? undefined,
                            architectureText:
                                merged.architectureText ??
                                enSections.architecture ??
                                undefined,
                        });
                    }
                }
            } catch (error) {
                console.warn("Wikipedia fetch failed:", error);
            }
        }
    }

    /* -------------------------------------------------------
       4) OSM — overrides suaves (nome antigo + contactos)
       ------------------------------------------------------- */
    if (sourceFeature?.properties) {
        const props = sourceFeature.properties || {};
        const tooltipName = featurePrimaryName(sourceFeature);

        if (tooltipName) {
            const currentLabel = merged.label ?? null;
            if (currentLabel && normalizeText(currentLabel) !== normalizeText(tooltipName)) {
                merged.oldNames = Array.from(
                    new Set([...(merged.oldNames ?? []), currentLabel])
                );
            }
        }

        const osmPhone = props.phone || props["contact:phone"] || null;
        const osmEmail = props.email || props["contact:email"] || null;
        const osmWebsite = props.website || props["contact:website"] || null;

        if (osmPhone || osmEmail || osmWebsite) {
            merged.contacts =
                mergeContacts(merged.contacts, {
                    phone: osmPhone ?? undefined,
                    email: osmEmail ?? undefined,
                    website: osmWebsite ?? undefined,
                }) ?? merged.contacts;
        }
    }

    /* -------------------------------------------------------
       5) Normalização final
       ------------------------------------------------------- */
    merged.images = (merged.images ?? []).filter(Boolean);
    if ((merged.images?.length ?? 0) > 48) {
        merged.images = merged.images!.slice(0, 48);
    }

    const hasAnyUsefulField =
        merged.label ||
        merged.description ||
        merged.image ||
        (merged.images && merged.images.length > 0) ||
        merged.website ||
        merged.contacts ||
        merged.openingHours ||
        (merged.ratings && merged.ratings.length > 0);

    return hasAnyUsefulField ? (merged as PoiInfo) : null;
}