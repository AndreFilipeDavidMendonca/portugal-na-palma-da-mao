// src/lib/poiInfo.ts
// -------------------------------------------------------------------
// NOVA VERSÃO — Google para fotos + horários; Wikipédia para o texto.
// Nome e coordenadas vêm do Google (mais fiável que OSM).
// -------------------------------------------------------------------

import {
    loadGoogleMaps,
    getPlaceDetailsById,
    photoUrlsFromPlace,
    findPlaceByNameAndPoint,
} from "@/lib/gplaces";
import { compactOpeningHours } from "@/utils/openingHours";

/* ===========================
   Tipos
   =========================== */
export type OpeningHours = { raw?: string | null; isOpenNow?: boolean; nextChange?: string | null };
export type Contacts = { phone?: string | null; email?: string | null; website?: string | null };
export type Ratings = { source: "google"; value: number; votes?: number | null };
export type BuiltPeriod = { start?: string | null; end?: string | null; opened?: string | null };

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

/* ===========================
   Wikipedia endpoints
   =========================== */
const WIKIPEDIA_SUMMARY = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

const WIKIPEDIA_SEARCH = (lang: string, q: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q
    )}&format=json&origin=*`;

const WIKIPEDIA_GEOSEARCH = (lang: string, lat: number, lon: number, radius = 800) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=20&format=json&origin=*`;

const WIKIPEDIA_PARSE = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
        title
    )}&prop=sections|text&format=json&origin=*`;

/* ===========================
   Utils básicos
   =========================== */
const uniq = <T,>(a: T[]) => Array.from(new Set(a));
const normalize = (s?: string | null) =>
    (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

const tokenOverlap = (a?: string | null, b?: string | null) => {
    const A = new Set(normalize(a).split(" ").filter(Boolean));
    const B = new Set(normalize(b).split(" ").filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0;
    A.forEach((t) => {
        if (B.has(t)) hit++;
    });
    return hit / Math.min(A.size, B.size);
};

async function safeJson(url: string) {
    const r = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

function htmlToText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ps = Array.from(doc.querySelectorAll("p"));
    return ps.map((p) => p.textContent?.trim() || "").filter(Boolean).join("\n\n");
}

/* ===========================
   Wikipedia helpers
   =========================== */
export type WikipediaTag = { lang: string; title: string };

function parseWikipediaTag(raw?: string | null): WikipediaTag | null {
    if (!raw) return null;
    const parts = raw.split(":");
    if (parts.length >= 2) {
        const lang = parts.shift()!.trim().toLowerCase();
        const title = parts.join(":").trim();
        if (lang && title) return { lang, title };
    }
    return { lang: "pt", title: raw.trim() };
}

async function fetchFromWikipediaStrict(
    lang: string,
    title: string,
    approx?: { lat: number; lon: number } | null,
    maxKm = 60
): Promise<Partial<PoiInfo>> {
    const jd = await safeJson(WIKIPEDIA_SUMMARY(lang, title));
    const wlat = jd?.coordinates?.lat;
    const wlon = jd?.coordinates?.lon;
    const wpCoords = typeof wlat === "number" && typeof wlon === "number" ? { lat: wlat, lon: wlon } : null;

    if (approx && wpCoords) {
        const R = 6371;
        const dLat = ((approx.lat - wpCoords.lat) * Math.PI) / 180;
        const dLon = ((approx.lon - wpCoords.lon) * Math.PI) / 180;
        const la1 = (approx.lat * Math.PI) / 180,
            la2 = (wpCoords.lat * Math.PI) / 180;
        const x =
            Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
        const dist = 2 * R * Math.asin(Math.sqrt(x));
        if (dist > maxKm) return {};
    }

    return {
        label: jd?.title ?? null,
        description: jd?.extract ?? null,
        wikipediaUrl: jd?.content_urls?.desktop?.page ?? null,
        coords: wpCoords ?? null,
    };
}

async function fetchWikipediaSections(
    lang: string,
    title: string
): Promise<{ history?: string | null; architecture?: string | null }> {
    const tryLang = async (lng: string) => {
        try {
            const jd = await safeJson(WIKIPEDIA_PARSE(lng, title));
            const html = jd?.parse?.text?.["*"];
            if (!html) return { history: null, architecture: null };

            const doc = new DOMParser().parseFromString(html, "text/html");
            const sections: Record<string, string> = {};
            let current = "";
            const nodes = Array.from(doc.body.childNodes);
            const push = (k: string, v: string) => {
                sections[k] = (sections[k] || "") + v;
            };

            for (const n of nodes) {
                if ((n as HTMLElement).nodeType === 1) {
                    const el = n as HTMLElement;
                    if (/^H[2-4]$/.test(el.tagName)) {
                        current = (el.textContent || "").trim().toLowerCase();
                        continue;
                    }
                    if (
                        current &&
                        (el.tagName === "P" || el.tagName === "UL" || el.tagName === "OL")
                    )
                        push(current, el.outerHTML);
                }
            }

            const getFirstParas = (keys: string[]) => {
                for (const k of keys) {
                    const hit = Object.entries(sections).find(([hdr]) => hdr.includes(k));
                    if (hit) {
                        const text = htmlToText(hit[1]).trim();
                        if (text) return text;
                    }
                }
                return null;
            };

            const history = getFirstParas(["história", "history"]);
            const architecture = getFirstParas(["arquitetura", "architecture"]);
            return { history, architecture };
        } catch {
            return { history: null, architecture: null };
        }
    };

    const pt = await tryLang(lang);
    if (pt.history || pt.architecture) return pt;
    return await tryLang("en");
}

export async function searchWikipediaTitleByName(
    name: string,
    lang: string = "pt"
): Promise<WikipediaTag | null> {
    try {
        const api = WIKIPEDIA_SEARCH(lang, name);
        const jd = await safeJson(api);
        const first = jd?.query?.search?.[0];
        if (!first) return null;
        return { lang, title: first.title as string };
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
        const api = WIKIPEDIA_GEOSEARCH(lang, lat, lon, 800);
        const jd = await safeJson(api);

        const items: Array<{ title: string; dist?: number }> = jd?.query?.geosearch ?? [];
        if (!items.length) return null;

        const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const qn = norm(name ?? "");

        const best =
            items.find((i) => (qn ? norm(i.title).includes(qn.split(" ")[0]) : false)) ?? items[0];

        return best ? { lang, title: best.title } : null;
    } catch {
        return null;
    }
}

/* ===========================
   OSM helpers (usado só para nomes antigos/auxiliares)
   =========================== */
function featurePrimaryName(f?: any | null): string | null {
    if (!f) return null;
    const p = f?.properties ?? {};
    const tags = p.tags ?? {};
    return (
        p["name:pt"] ||
        p.name ||
        p["name:en"] ||
        tags["name:pt"] ||
        tags.name ||
        tags["name:en"] ||
        null
    );
}

/* ===========================
   Google Places lookup (Text Search → Details)
   =========================== */
async function findBestGooglePlaceByNameNear(
    name: string,
    lat: number,
    lon: number
): Promise<any | null> {
    const g = await loadGoogleMaps();

    // container invisível para o service antigo
    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);

    const map = new g.maps.Map(div, { center: { lat, lng: lon }, zoom: 15 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    // 1) textSearch
    try {
        // @ts-ignore
        const textResults = await new Promise<google.maps.places.PlaceResult[]>(
            (resolve, reject) => {
                // @ts-ignore
                service.textSearch(
                    { query: name, location: { lat, lng: lon }, radius: 1500, language: "pt" } as any,
                    // @ts-ignore
                    (res, status) => {
                        // @ts-ignore
                        if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
                        else reject(new Error(`textSearch: ${status}`));
                    }
                );
            }
        );

        if (textResults?.length) {
            const picked = textResults
                .map((r) => ({ r, score: tokenOverlap(name, r.name || "") * 10 + (r.rating || 0) }))
                .sort((a, b) => b.score - a.score)[0]?.r;

            if (picked?.place_id) {
                const det = await getPlaceDetailsById(picked.place_id);
                return det || null;
            }
        }
    } catch (e) {
        console.warn("textSearch falhou, a tentar nearbySearch como fallback.", e);
    }

    // 2) nearbySearch
    try {
        // @ts-ignore
        const nearby = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
            // @ts-ignore
            service.nearbySearch(
                { location: { lat, lng: lon }, radius: 1200, keyword: name, language: "pt" } as any,
                // @ts-ignore
                (res, status) => {
                    // @ts-ignore
                    if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
                    else reject(new Error(`nearbySearch: ${status}`));
                }
            );
        });

        if (nearby?.length) {
            const picked = nearby
                .map((r) => ({ r, score: tokenOverlap(name, r.name || "") * 10 + (r.rating || 0) }))
                .sort((a, b) => b.score - a.score)[0]?.r;

            if (picked?.place_id) {
                const det = await getPlaceDetailsById(picked.place_id);
                return det || null;
            }
        }
    } catch (e) {
        console.warn("nearbySearch também falhou.", e);
    }

    return null;
}

/* ===========================
   MERGE helpers
   =========================== */
function mergeContacts(a?: Contacts | null, b?: Contacts | null): Contacts | undefined {
    if (!a && !b) return undefined;
    return {
        phone: (b?.phone ?? a?.phone) ?? undefined,
        email: (b?.email ?? a?.email) ?? undefined,
        website: (b?.website ?? a?.website) ?? undefined,
    };
}

function mergePoiPieces(a: Partial<PoiInfo>, b: Partial<PoiInfo>): Partial<PoiInfo> {
    const out: Partial<PoiInfo> = { ...a };
    const take = <T,>(v: T | null | undefined, cur: T | null | undefined): T | undefined =>
        v === 0 || v === false || (Array.isArray(v) && v.length) || (!!v && v !== "")
            ? (v as any)
            : (cur as any);

    out.label = a.label ?? b.label ?? out.label ?? null;
    out.description = take(b.description, a.description) ?? out.description;
    out.image = take(b.image, a.image) ?? out.image;
    out.images = b.images?.length ? uniq([...(a.images ?? []), ...b.images]) : a.images ?? out.images;
    out.wikipediaUrl = a.wikipediaUrl ?? b.wikipediaUrl ?? out.wikipediaUrl ?? null;

    out.coords = a.coords ?? b.coords ?? out.coords ?? null;
    out.website = a.website ?? b.website ?? out.website ?? null;

    out.openingHours = b.openingHours ?? a.openingHours ?? out.openingHours ?? null;
    out.ratings = b.ratings ?? a.ratings ?? out.ratings;

    out.historyText = take(b.historyText, a.historyText) ?? out.historyText;
    out.architectureText = take(b.architectureText, a.architectureText) ?? out.architectureText;

    return out;
}

/* ===========================
   Orquestrador
   =========================== */
export async function fetchPoiInfo(opts: {
    wikipedia?: string | null;
    approx?: { name?: string | null; lat?: number | null; lon?: number | null } | null;
    sourceFeature?: any | null;
}): Promise<PoiInfo | null> {
    let merged: Partial<PoiInfo> = { images: [] };

    const approxName = opts.approx?.name ?? null;
    const approxLat = opts.approx?.lat ?? null;
    const approxLon = opts.approx?.lon ?? null;
    const approxCoords =
        approxLat != null && approxLon != null ? { lat: approxLat, lon: approxLon } : null;

    // 1) Google — corrige nome/coords e traz fotos/horário/rating/website
    try {
        if (approxName && approxCoords) {
            const hit =
                (await findPlaceByNameAndPoint(approxName, approxCoords.lat, approxCoords.lon, 300)) ??
                (await findBestGooglePlaceByNameNear(approxName, approxCoords.lat, approxCoords.lon));

            if (hit?.place_id) {
                const det = await getPlaceDetailsById(hit.place_id);

                const name = det?.displayName?.text || det?.name || hit.name || approxName || null;

                const loc = det?.location
                    ? { lat: det.location.lat(), lon: det.location.lng() }
                    : { lat: hit.lat, lon: hit.lng };

                const website = (det as any).websiteUri ?? det.website ?? undefined;

                const ratingVal = typeof det.rating === "number" ? det.rating : undefined;

                const ratingCount =
                    typeof (det as any).userRatingCount === "number"
                        ? (det as any).userRatingCount
                        : typeof det.user_ratings_total === "number"
                            ? det.user_ratings_total
                            : null;

                const compact = det.opening_hours?.weekday_text
                    ? compactOpeningHours(det.opening_hours.weekday_text)
                    : undefined;

                const opening = det.opening_hours
                    ? {
                        raw: typeof compact === "string" ? compact : JSON.stringify(compact),
                        isOpenNow:
                            typeof det.opening_hours.isOpen === "function"
                                ? !!det.opening_hours.isOpen()
                                : undefined,
                    }
                    : undefined;

                const photos = photoUrlsFromPlace(det, 1600);

                merged = mergePoiPieces(merged, {
                    label: name,
                    coords: loc,
                    website,
                    openingHours: opening,
                    ratings:
                        typeof ratingVal === "number"
                            ? [{ source: "google", value: Math.max(0, Math.min(5, ratingVal)), votes: ratingCount }]
                            : undefined,
                    image: photos[0],
                    images: photos.slice(1),
                });
            }
        }
    } catch (e) {
        console.warn("Google resolver falhou:", e);
    }

    // 2) Wikipédia — texto/sections (com base no nome/coords já corrigidos)
    const baseName = merged.label ?? approxName ?? null;
    const baseCoords = merged.coords ?? approxCoords ?? null;

    let wpTag = parseWikipediaTag(opts.wikipedia ?? null) || null;
    if (!wpTag && baseName) {
        if (baseCoords) {
            const near = await geosearchWikipediaTitleSmart(baseCoords.lat, baseCoords.lon, baseName);
            if (near) wpTag = near;
        }
        if (!wpTag) {
            const byNamePt = await searchWikipediaTitleByName(baseName, "pt");
            wpTag = byNamePt ?? (await searchWikipediaTitleByName(baseName));
        }
    }

    if (wpTag) {
        try {
            const wp = await fetchFromWikipediaStrict(wpTag.lang, wpTag.title, baseCoords, 60);
            if (Object.keys(wp).length) {
                merged = mergePoiPieces(merged, {
                    description: wp.description ?? undefined,
                    wikipediaUrl: (wp as any).wikipediaUrl ?? undefined,
                });

                const sections = await fetchWikipediaSections(wpTag.lang, wpTag.title);
                merged = mergePoiPieces(merged, {
                    historyText: sections.history ?? undefined,
                    architectureText: sections.architecture ?? undefined,
                });
            }
        } catch {
            /* ignore */
        }
    }

    // 3) Overrides opcionais do feature OSM (nome antigo, contactos)
    if (opts.sourceFeature?.properties) {
        const p = opts.sourceFeature.properties || {};
        const tooltipName = featurePrimaryName(opts.sourceFeature);

        if (tooltipName) {
            const old = merged.label ?? null;
            if (old && normalize(old) !== normalize(tooltipName)) {
                merged.oldNames = Array.from(new Set([...(merged.oldNames ?? []), old]));
            }
            // Mantemos o nome do Google como principal
        }

        const osmPhone = p.phone || p["contact:phone"] || null;
        const osmEmail = p.email || p["contact:email"] || null;
        const osmWebsite = p.website || p["contact:website"] || null;
        if (osmPhone || osmEmail || osmWebsite) {
            merged.contacts =
                mergeContacts(merged.contacts, {
                    phone: osmPhone ?? undefined,
                    email: osmEmail ?? undefined,
                    website: osmWebsite ?? undefined,
                }) ?? merged.contacts;
        }
    }

    // 4) Normalização final
    merged.images = (merged.images ?? []).filter(Boolean);
    if ((merged.images?.length ?? 0) > 48) merged.images = merged.images!.slice(0, 48);

    const hasAny =
        merged.label ||
        merged.description ||
        merged.image ||
        (merged.images && merged.images.length > 0) ||
        merged.website ||
        merged.contacts ||
        merged.openingHours ||
        (merged.ratings && merged.ratings.length > 0);

    return hasAny ? (merged as PoiInfo) : null;
}