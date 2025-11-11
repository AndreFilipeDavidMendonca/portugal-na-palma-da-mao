// src/lib/poiInfo.ts
import { nearbyViewpointsByCoords, getPlaceDetailsById, photoUrlsFromPlace } from "@/lib/gplaces";
import {compactOpeningHours} from "@/utils/openingHours";

/* ===========================
   Tipos
   =========================== */
export type OpeningHours = {
    raw?: string | null;
    isOpenNow?: boolean;
    nextChange?: string | null; // ISO
};
export type Contacts = {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
};
export type Ratings = {
    source: "opentripmap" | "google";
    value: number;        // 0..5
    votes?: number | null;
};
export type BuiltPeriod = {
    start?: string | null;   // yyyy or yyyy-mm-dd
    end?: string | null;     // yyyy or yyyy-mm-dd
    opened?: string | null;  // yyyy or yyyy-mm-dd
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

/* ===========================
   Endpoints (não usados em viewpoint, mas mantidos para os restantes)
   =========================== */
const WIKIDATA_SEARCH = (term: string, lang = "pt") =>
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=${lang}&format=json&origin=*`;
const WIKIPEDIA_SUMMARY = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
const WIKIPEDIA_MEDIA_LIST = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
const WIKIPEDIA_SEARCH = (lang: string, q: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
const WIKIPEDIA_GEOSEARCH = (lang: string, lat: number, lon: number, radius = 800) =>
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=20&format=json&origin=*`;
const WIKIPEDIA_PARSE = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections|text&format=json&origin=*`;

const COMMONS_FILE = (fileName: string) =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
const COMMONS_API = `https://commons.wikimedia.org/w/api.php?origin=*&format=json`;
const commonsCategoryMembers = (category: string, limit = 60) =>
    `${COMMONS_API}&action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmnamespace=6&cmtype=file&cmlimit=${limit}`;

const OTM_KEY = (import.meta as any).env?.VITE_OPENTRIPMAP_KEY as string | undefined;
const OTM_BASE = "https://api.opentripmap.com/0.1";
const OTM_PLACE_BY_NAME = (lat: number, lon: number, name: string) =>
    `${OTM_BASE}/en/places/radius?radius=300&lon=${lon}&lat=${lat}&name=${encodeURIComponent(name)}&apikey=${OTM_KEY}`;
const OTM_DETAILS = (xid: string) =>
    `${OTM_BASE}/en/places/xid/${encodeURIComponent(xid)}?apikey=${OTM_KEY}`;

const OVERPASS = "https://overpass-api.de/api/interpreter";
const overpassQL = (q: string) => `${OVERPASS}?data=${encodeURIComponent(q)}`;

/* ===========================
   Utils
   =========================== */
function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
function firstNonEmpty<T>(...vals: (T | null | undefined)[]): T | undefined {
    for (const v of vals) {
        if (v === 0 || v === false) return v as any;
        if (v != null && v !== "" && !(Array.isArray(v) && (v as any).length === 0)) return v as T;
    }
    return undefined;
}
async function safeJson(url: string) {
    const r = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}
function htmlToText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ps = Array.from(doc.querySelectorAll("p"));
    return ps.map(p => p.textContent?.trim() || "").filter(Boolean).join("\n\n");
}

const normalize = (s?: string | null) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

function tokenOverlap(a?: string | null, b?: string | null) {
    const A = new Set(normalize(a).split(" ").filter(Boolean));
    const B = new Set(normalize(b).split(" ").filter(Boolean));
    if (!A.size || !B.size) return 0;
    let hit = 0; A.forEach(t => { if (B.has(t)) hit++; });
    return hit / Math.min(A.size, B.size);
}

function normalizeCommonsUrl(u: string): string {
    try {
        const url = new URL(u);
        if (!/commons\.wikimedia\.org$/i.test(url.hostname)) return u;
        const p = url.pathname;
        const extract = (s: string) => decodeURIComponent(s).split(":").pop()!.trim();

        if (/\/wiki\/Special:Redirect\/file\//i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/Special:Redirect\/file\//i, "");
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(extract(filePart))}`;
        }
        if (/\/wiki\/(File|Ficheiro):/i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/(File|Ficheiro):/i, "");
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(extract(filePart))}`;
        }
        return u;
    } catch { return u; }
}
function normalizeImageUrls(imgs?: string[] | null): string[] | undefined {
    if (!imgs || imgs.length === 0) return undefined;
    return uniq(imgs.map(normalizeCommonsUrl));
}

/* ===========================
   Merge helpers
   =========================== */

function filterBadImages(urls: string[]): string[] {
    const badRx = /(sprite|icon|logo|map|pin|marker|favicon)/i;
    return urls.filter(u => {
        if (!u) return false;
        const ext = u.split("?")[0].split(".").pop()?.toLowerCase() || "";
        if (/(svg|gif|ico|webp)$/.test(ext)) return false; // podes ajustar
        if (badRx.test(u)) return false;
        return true;
    });
}

/** Escolhe o conjunto que “traz mais” (com desempate por prioridade) */
function pickBestImageSet(
    candidates: Record<"wikipedia" | "commons" | "opentripmap" | "existing", string[]>,
    priority: Array<keyof typeof candidates> = ["wikipedia", "commons", "opentripmap", "existing"],
    maxKeep = 20
): { primary: string | undefined; gallery: string[] } {
    // normaliza & filtra
    const norm: Record<string, string[]> = {};
    (Object.keys(candidates) as Array<keyof typeof candidates>).forEach(k => {
        const arr = normalizeImageUrls(filterBadImages(candidates[k] ?? [])) ?? [];
        norm[k] = Array.from(new Set(arr));
    });

    // escolhe pela contagem; se empatar, usa prioridade
    const bestKey = (Object.keys(norm) as Array<keyof typeof norm>)
        .sort((a, b) => {
            const da = norm[a].length, db = norm[b].length;
            if (db !== da) return db - da;
            return priority.indexOf(a as any) - priority.indexOf(b as any);
        })[0];

    const chosen = norm[bestKey] ?? [];
    if (chosen.length === 0) return { primary: undefined, gallery: [] };

    // primary + galeria
    const primary = chosen[0];
    const rest = chosen.slice(1, maxKeep);

    return { primary, gallery: rest };
}

function mergeContacts(a?: Contacts | null, b?: Contacts | null): Contacts | undefined {
    if (!a && !b) return undefined;
    return {
        phone: firstNonEmpty(b?.phone, a?.phone) ?? undefined,
        email: firstNonEmpty(b?.email, a?.email) ?? undefined,
        website: firstNonEmpty(b?.website, a?.website) ?? undefined,
    };
}
function mergeOpeningHours(a?: OpeningHours | null, b?: OpeningHours | null): OpeningHours | undefined {
    if (!a && !b) return undefined;
    return {
        raw: firstNonEmpty(b?.raw, a?.raw) ?? undefined,
        isOpenNow: firstNonEmpty(b?.isOpenNow, a?.isOpenNow) ?? undefined,
        nextChange: firstNonEmpty(b?.nextChange, a?.nextChange) ?? undefined,
    };
}
function mergeRatings(a?: Ratings[] | null, b?: Ratings[] | null): Ratings[] | undefined {
    const all = [...(a ?? []), ...(b ?? [])];
    if (all.length === 0) return undefined;
    const bySource = new Map<string, Ratings>();
    for (const r of all) if (!bySource.has(r.source)) bySource.set(r.source, r);
    return Array.from(bySource.values());
}
function mergePoiPieces(a: Partial<PoiInfo>, b: Partial<PoiInfo>): Partial<PoiInfo> {
    const out: Partial<PoiInfo> = { ...a };
    out.label        = firstNonEmpty(a.label,        b.label)        ?? out.label;
    out.description  = firstNonEmpty(a.description,  b.description)  ?? out.description;
    out.image        = firstNonEmpty(a.image,        b.image)        ?? out.image;
    out.inception    = firstNonEmpty(a.inception,    b.inception)    ?? out.inception;
    out.wikipediaUrl = firstNonEmpty(a.wikipediaUrl, b.wikipediaUrl) ?? out.wikipediaUrl;
    out.wikidataId   = firstNonEmpty(a.wikidataId,   b.wikidataId)   ?? out.wikidataId;

    const imgs = normalizeImageUrls([...(a.images ?? []), ...(b.images ?? [])]);
    if (imgs && imgs.length) out.images = imgs;

    out.coords  = firstNonEmpty(a.coords,  b.coords)  ?? out.coords;
    out.website = firstNonEmpty(a.website, b.website) ?? out.website;

    const inst = uniq([...(a.instanceOf ?? []), ...(b.instanceOf ?? [])]);
    if (inst.length) out.instanceOf = inst;
    const loc = uniq([...(a.locatedIn ?? []), ...(b.locatedIn ?? [])]);
    if (loc.length) out.locatedIn = loc;
    const her = uniq([...(a.heritage ?? []), ...(b.heritage ?? [])]);
    if (her.length) out.heritage = her;

    out.contacts     = mergeContacts(a.contacts, b.contacts) ?? out.contacts;
    out.openingHours = mergeOpeningHours(a.openingHours, b.openingHours) ?? out.openingHours;
    const rat = mergeRatings(a.ratings, b.ratings); if (rat && rat.length) out.ratings = rat;

    out.historyText       = firstNonEmpty(a.historyText,       b.historyText)       ?? out.historyText;
    out.architectureText  = firstNonEmpty(a.architectureText,  b.architectureText)  ?? out.architectureText;

    const archs = uniq([...(a.architects ?? []), ...(b.architects ?? [])]);
    if (archs.length) out.architects = archs;
    const styles = uniq([...(a.architectureStyles ?? []), ...(b.architectureStyles ?? [])]);
    if (styles.length) out.architectureStyles = styles;
    const mats = uniq([...(a.materials ?? []), ...(b.materials ?? [])]);
    if (mats.length) out.materials = mats;

    const builders = uniq([...(a.builders ?? []), ...(b.builders ?? [])]);
    if (builders.length) out.builders = builders;

    out.builtPeriod = {
        start:  firstNonEmpty(a.builtPeriod?.start,  b.builtPeriod?.start)  ?? out.builtPeriod?.start,
        end:    firstNonEmpty(a.builtPeriod?.end,    b.builtPeriod?.end)    ?? out.builtPeriod?.end,
        opened: firstNonEmpty(a.builtPeriod?.opened, b.builtPeriod?.opened) ?? out.builtPeriod?.opened,
    };

    return out;
}

/* ===========================
   Helpers diversos
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
const normStr = (s?: string | null) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "").replace(/\s+/g, " ")
        .trim().toLowerCase();

/* ===========================
   Wikidata / Wikipedia / OTM / OSM (apenas para não-viewpoints)
   =========================== */
async function searchWikidataIdByName(name: string): Promise<string | null> {
    try {
        const url = WIKIDATA_SEARCH(name, "pt");
        const jd = await safeJson(url);
        const hit = jd?.search?.[0];
        if (hit?.id) {
            console.log("🧠 Wikidata search hit:", { name, id: hit.id, label: hit.label });
            return hit.id as string;
        }
        return null;
    } catch {
        return null;
    }
}
function parseWikipediaTag(raw?: string | null): { lang: string; title: string } | null {
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
    const wpCoords = (typeof wlat === "number" && typeof wlon === "number")
        ? { lat: wlat, lon: wlon }
        : null;

    if (approx && wpCoords) {
        const R = 6371;
        const dLat = (approx.lat - wpCoords.lat) * Math.PI / 180;
        const dLon = (approx.lon - wpCoords.lon) * Math.PI / 180;
        const la1 = approx.lat * Math.PI / 180, la2 = wpCoords.lat * Math.PI / 180;
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
        const dist = 2 * R * Math.asin(Math.sqrt(x));
        if (dist > maxKm) return {};
    }

    console.log('fetchFromWikipediaStrict' , jd)
    const image = jd?.originalimage?.source ?? jd?.thumbnail?.source ?? null;
    return {
        label: jd?.title ?? null,
        description: jd?.extract ?? null,
        image,
        wikipediaUrl: jd?.content_urls?.desktop?.page ?? null,
        coords: wpCoords ?? null
    };
}
async function fetchImagesFromWikipediaMediaList(lang: string, title: string): Promise<string[]> {
    try {
        const jd = await safeJson(WIKIPEDIA_MEDIA_LIST(lang, title));
        const xs: string[] = [];
        for (const item of jd?.items ?? []) {
            if (item?.type === "image" && item?.title) xs.push(COMMONS_FILE(item.title.replace(/^File:/i, "")));
        }
        console.log('fetchImagesFromWikipediaMediaList' , jd)

        return xs;
    } catch { return []; }
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
            const push = (k: string, v: string) => { sections[k] = (sections[k] || "") + v; };

            for (const n of nodes) {
                if ((n as HTMLElement).nodeType === 1) {
                    const el = n as HTMLElement;
                    if (/^H[2-4]$/.test(el.tagName)) { current = (el.textContent || "").trim().toLowerCase(); continue; }
                    if (current && (el.tagName === "P" || el.tagName === "UL" || el.tagName === "OL")) push(current, el.outerHTML);
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
        } catch { return { history: null, architecture: null }; }
    };

    const pt = await tryLang(lang);
    if (pt.history || pt.architecture) return pt;
    return await tryLang("en");
}
async function searchWikipediaTitleByName(name: string) {
    try {
        const tryLang = async (lang: string) => {
            const jd = await safeJson(WIKIPEDIA_SEARCH(lang, name));
            const hit = jd?.query?.search?.[0];
            if (!hit?.title) return null;
            return { lang, title: hit.title as string };
        };
        return (await tryLang("pt")) || (await tryLang("en"));
    } catch { return null; }
}
async function geosearchWikipediaTitleSmart(
    lat: number,
    lon: number,
    approxName?: string | null
) {
    const vpRx = /\b(miradouro|view[_\s-]?point|mirador|belvedere|mirante|overlook)\b/i;

    const tryLang = async (lang: string) => {
        try {
            const jd = await safeJson(WIKIPEDIA_GEOSEARCH(lang, lat, lon, 800));
            const items: Array<{ title?: string; dist?: number }> = jd?.query?.geosearch ?? [];
            if (!items.length) return null;

            const scored = items.map((it) => {
                const title = it.title || "";
                const ov = tokenOverlap(approxName, title);
                const hasVP = vpRx.test(title);
                const dist = Number(it.dist ?? 999999);
                const proximity = Math.max(0, 1 - dist / 800);
                const score = ov * 8 + proximity * 3 + (hasVP ? 5 : 0);
                return { title, score, ov, hasVP, dist };
            }).sort((a, b) => b.score - a.score);

            const best = scored[0];
            if (!best) return null;
            if (!(best.hasVP || best.ov >= 0.35)) return null;

            return { lang, title: best.title };
        } catch { return null; }
    };

    return (await tryLang("pt")) || (await tryLang("en"));
}
export async function fetchFromOSMDeep(opts: {
    osmId?: string | null;
    wikidata?: string | null;
    coords?: { lat: number; lon: number } | null;
    name?: string | null;
}): Promise<Partial<PoiInfo>> {
    let q = "";
    if (opts.osmId) {
        const [type, id] = String(opts.osmId).split("/");
        if (!type || !id) return {};
        q = `
[out:json][timeout:25];
${type}(${id});
out tags center;`;
    } else if (opts.wikidata) {
        q = `
[out:json][timeout:25];
(
  node["wikidata"="${opts.wikidata}"];
  way["wikidata"="${opts.wikidata}"];
  relation["wikidata"="${opts.wikidata}"];
);
out tags center;`;
    } else if (opts.coords && opts.name) {
        const { lat, lon } = opts.coords;
        const name = opts.name.replace(/"/g, '\\"');
        q = `
[out:json][timeout:25];
(
  node(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
  way(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
  relation(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
);
out tags center;`;
    } else { return {}; }

    try {
        const jd = await safeJson(overpassQL(q));
        const el = jd?.elements?.[0];
        const tags = el?.tags ?? {};

        console.log('fetchFromOSMDeep' , jd)

        const contacts: Contacts = {
            phone: tags["phone"] || tags["contact:phone"] || null,
            email: tags["email"] || tags["contact:email"] || null,
            website: tags["website"] || tags["contact:website"] || null,
        };
        const openingHours: OpeningHours | null = tags["opening_hours"] ? { raw: tags["opening_hours"] } : null;

        const description: string | undefined = tags["description"] || undefined;

        let builtPeriod: PoiInfo["builtPeriod"] | undefined;
        const sd = tags["start_date"] || null;
        if (sd) {
            const s = String(sd).trim();
            const mRange = s.match(/^(\d{3,4})(?:-\d{2})?-(\d{3,4})(?:-\d{2})?(?:-\d{2})?$/);
            if (mRange) builtPeriod = { start: mRange[1], end: mRange[2] };
            else {
                const mPlus = s.match(/^(\d{3,4})\+$/);
                if (mPlus) builtPeriod = { start: mPlus[1] };
                else {
                    const mDate = s.match(/^(\d{3,4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
                    if (mDate) {
                        const [_, y, m, d] = mDate;
                        builtPeriod = { start: y && m && d ? `${y}-${m}-${d}` : y && m ? `${y}-${m}` : y || undefined };
                    }
                }
            }
        }

        return {
            contacts: (contacts.phone || contacts.email || contacts.website) ? contacts : undefined,
            openingHours: openingHours ?? undefined,
            website: contacts.website ?? undefined,
            description,
            builtPeriod,
        };
    } catch { return {}; }
}
export async function fetchFromOpenTripMap(name: string, lat: number, lon: number): Promise<Partial<PoiInfo> & { label?: string | null }> {
    if (!OTM_KEY) return {};
    try {
        const search = await safeJson(OTM_PLACE_BY_NAME(lat, lon, name));
        const place = search?.features?.[0];
        const xid = place?.properties?.xid;
        if (!xid) return {};
        const det = await safeJson(OTM_DETAILS(xid));

        const ratingVal = Number(det?.rate ?? 0);
        const images: string[] = (det?.preview?.source ? [det.preview.source] : [])
            .concat((det?.images ?? []).map((im: any) => im?.preview || im?.source).filter(Boolean));
        const ratings: Ratings[] =
            isFinite(ratingVal) && ratingVal > 0
                ? [{ source: "opentripmap", value: Math.min(5, Math.max(0, ratingVal)), votes: null }]
                : [];

        const desc = det?.wikipedia_extracts?.text || undefined;
        const label = det?.name || place?.properties?.name || name;

        console.log('fetchFromOpenTripMap', images)
        return { ratings, images, description: desc, label, kinds: det?.kinds };
    } catch { return {}; }
}

/* ===========================
   Heurística de tipo (para decidir a rota)
   =========================== */
function typeHintFromName(name?: string | null): "viewpoint" | "church" | "ruins" | null {
    if (!name) return null;
    const n = name.toLowerCase();
    if (/miradouro|viewpoint|mirador/.test(n)) return "viewpoint";
    if (/igreja|church|sé|catedral|mosteiro|convento|capela/.test(n)) return "church";
    if (/ru[ií]nas?|castro/.test(n)) return "ruins";
    return null;
}

/* ===========================
   Orquestrador
   =========================== */
export async function fetchPoiInfo(opts: {
    wikidata?: string | null;
    wikipedia?: string | null;
    osmId?: string | null;
    approx?: { name?: string | null; lat?: number | null; lon?: number | null } | null;
    /** opcional: feature OSM de origem para merge/override de título */
    sourceFeature?: any | null;
}): Promise<PoiInfo | null> {
    let merged: Partial<PoiInfo> = { images: [] };

    const approxName = opts.approx?.name ?? null;
    const approxLat = opts.approx?.lat ?? null;
    const approxLon = opts.approx?.lon ?? null;
    const approxCoords = (approxLat != null && approxLon != null)
        ? { lat: approxLat, lon: approxLon }
        : null;

    const typeHint = typeHintFromName(approxName);

    // 🔹 Google Places (só quando é viewpoint) — JS SDK sem CORS
    if (typeHint === "viewpoint" && approxCoords) {
        console.log("🛰️ Google Places enrichment (JS SDK) for viewpoint");
        try {
            const results = await nearbyViewpointsByCoords(approxCoords.lat, approxCoords.lon, 3000);
            if (results.length) {
                // pick mais provável por overlap com o nome aproximado + rating
                const picked = results
                    .map(r => {
                        const ov = tokenOverlap(approxName, r.name || "");
                        const score = ov * 10 + (r.rating ?? 0);
                        return { r, score };
                    })
                    .sort((a, b) => b.score - a.score)[0]?.r;

                if (picked?.place_id) {
                    const det = await getPlaceDetailsById(picked.place_id);
                    const photos = photoUrlsFromPlace(det, 1600);

                    const website =
                        (det as any).websiteUri ?? det.website ?? undefined;

                    const ratingVal =
                        typeof det.rating === "number" ? det.rating : undefined;

                    const ratingCount =
                        typeof (det as any).userRatingCount === "number" ? (det as any).userRatingCount
                            : typeof det.user_ratings_total === "number" ? det.user_ratings_total
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

                    const name = det.name || picked.name || approxName || null;

                    const loc = det.geometry?.location
                        ? { lat: det.geometry.location.lat(), lon: det.geometry.location.lng() }
                        : approxCoords || null;

                    // prepara patch e só depois faz o merge na variável 'merged' (NÃO usar merged2)
                    const patch: Partial<PoiInfo> = {
                        label: name,
                        coords: loc || undefined,
                        website,
                        openingHours: opening,
                        ratings:
                            typeof ratingVal === "number"
                                ? [{ source: "google", value: Math.max(0, Math.min(5, ratingVal)), votes: ratingCount }]
                                : undefined,
                        images: photos,
                        image: photos[0],
                    };

                    merged = mergePoiPieces(merged, patch);
                }
            }
        } catch (e) {
            console.warn("❌ Google Places (viewpoint) falhou:", e);
        }


        // Merge do feature OSM (override de título/contacts) — mantemos
        if (opts.sourceFeature?.properties) {
            const p = opts.sourceFeature.properties || {};
            const osmDesc    = p.description || p["description:pt"] || null;
            const osmOH      = p.opening_hours || null;
            const osmPhone   = p.phone || p["contact:phone"] || null;
            const osmEmail   = p.email || p["contact:email"] || null;
            const osmWebsite = p.website || p["contact:website"] || null;
            const startDate  = p.start_date || null;

            const tooltipName = featurePrimaryName(opts.sourceFeature);

            if (osmOH) merged.openingHours = mergeOpeningHours(merged.openingHours, { raw: osmOH }) ?? merged.openingHours;
            merged.contacts = mergeContacts(merged.contacts, { phone: osmPhone ?? undefined, email: osmEmail ?? undefined, website: osmWebsite ?? undefined }) ?? merged.contacts;
            merged.website = merged.website ?? osmWebsite ?? undefined;

            if (startDate && /^\+?\d{4}(-\d{2})?(-\d{2})?$/.test(String(startDate))) {
                merged.builtPeriod = merged.builtPeriod || {};
                if (!merged.builtPeriod.start) merged.builtPeriod.start = String(startDate).replace(/^\+/, "");
                if (!merged.inception) merged.inception = String(startDate).replace(/^\+/, "");
            }

            if (tooltipName) {
                const oldLabel = merged.label ?? null;
                if (oldLabel && normStr(tooltipName) !== normStr(oldLabel)) {
                    merged.oldNames = Array.from(new Set([...(merged.oldNames ?? []), oldLabel]));
                }
                merged.label = tooltipName;
            }

            // Não forçamos descrição: Google raramente tem editorial consistente
            if (osmDesc && !merged.description) merged.description = osmDesc;
        }

        // Normalização final de imagens (top-3 válidas)
        merged.images = normalizeImageUrls(merged.images) ?? [];
        if (merged.image) merged.image = normalizeCommonsUrl(merged.image);
        if (merged.images.length > 48) merged.images = merged.images.slice(0, 48);

        const gallery = (() => {
            const arr: string[] = [];
            const push = (s?: string | null) => {
                if (!s) return;
                const n = normalizeCommonsUrl(s);
                if (n && !arr.includes(n)) arr.push(n);
            };
            push(merged.image ?? null);
            for (const u of merged.images ?? []) push(u);
            return arr;
        })();

        const first3: string[] = [];
        for (const u of gallery) {
            // eslint-disable-next-line no-await-in-loop
            const ok = await new Promise<boolean>((resolve) => {
                const img = new Image();
                const t = setTimeout(() => resolve(false), 8000);
                img.onload = () => { clearTimeout(t); resolve(true); };
                img.onerror = () => { clearTimeout(t); resolve(false); };
                img.src = u;
            });
            if (ok) first3.push(u);
            if (first3.length >= 3) break;
        }
        if (first3.length > 0) {
            merged.image = first3[0];
            merged.images = first3.slice(1);
        } else {
            merged.image = undefined;
            merged.images = [];
        }

        const hasAny =
            merged.label || merged.description || merged.image ||
            (merged.images && merged.images.length > 0) ||
            merged.website || merged.contacts || merged.openingHours ||
            (merged.ratings && merged.ratings.length > 0) ||
            merged.builtPeriod;

        return (hasAny ? (merged as PoiInfo) : null);
    }

    /* ───────────── RESTO DOS TIPOS (pipeline antigo) ───────────── */
    console.log("🔎 START fetchPoiInfo", {
        approxName,
        coords: opts.approx,
        typeHint
    });

    // Resolver por nome/coords
    let wdId = opts.wikidata ?? null;
    let wpResolved: { lang: string; title: string } | null = null;

    // Agregador de descrições
    type DescSrc = "wikidata" | "wikipedia" | "opentripmap" | "osm";
    type DescCand = { text: string; src: DescSrc; title?: string | null; coords?: { lat: number; lon: number } | null; };
    const descCands: DescCand[] = [];
    const pushDesc = (text?: string | null, src?: DescSrc, meta?: { title?: string | null; coords?: {lat:number;lon:number} | null }) => {
        const t = (text || "").trim();
        if (!t || !src) return;
        if (!descCands.some(d => d.text === t)) descCands.push({ text: t, src, title: meta?.title ?? null, coords: meta?.coords ?? null });
    };

    if (!wdId && approxName) wdId = await searchWikidataIdByName(approxName);

    if (!opts.wikipedia && approxName) {
        if (approxCoords) wpResolved = await geosearchWikipediaTitleSmart(approxCoords.lat, approxCoords.lon, approxName);
        if (!wpResolved) {
            const byName = await searchWikipediaTitleByName(approxName);
            if (byName) wpResolved = byName;
        }
    }

    let wpTag = parseWikipediaTag(opts.wikipedia ?? null) || wpResolved || null;
    if (wpTag) {
        try {
            const wp = await fetchFromWikipediaStrict(wpTag.lang, wpTag.title, approxCoords, 60);
            if (Object.keys(wp).length) {
                const mediaImgs = await fetchImagesFromWikipediaMediaList(wpTag.lang, wpTag.title);
                merged = mergePoiPieces(merged, { ...wp, images: mediaImgs });
                pushDesc(wp.description, "wikipedia", { title: wp.label ?? wpTag.title, coords: (wp as any).coords ?? null });

                const sections = await fetchWikipediaSections(wpTag.lang, wpTag.title);
                merged = mergePoiPieces(merged, {
                    historyText: sections.history ?? undefined,
                    architectureText: sections.architecture ?? undefined,
                });
            }
        } catch { /* ignore */ }
    }

    try {
        const osmExtra = await fetchFromOSMDeep({
            osmId: opts.osmId ?? null,
            wikidata: wdId ?? null,
            coords: merged.coords ?? approxCoords ?? null,
            name: approxName ?? merged.label ?? null,
        });
        merged = mergePoiPieces(merged, osmExtra);
        pushDesc(osmExtra.description, "osm", { title: approxName ?? merged.label ?? null });
    } catch { /* ignore */ }

    try {
        const baseName = approxName ?? merged.label ?? null;
        const baseCoords = merged.coords ?? approxCoords ?? null;
        if (OTM_KEY && baseName && baseCoords) {
            const otm = await fetchFromOpenTripMap(baseName, baseCoords.lat, baseCoords.lon);
            const { ratings, images } = otm;
            if ((ratings && ratings.length) || (images && images.length)) {
                merged = mergePoiPieces(merged, { ratings, images });
            }
            if (otm.description) {
                pushDesc(otm.description, "opentripmap", { title: (otm as any).label ?? baseName, coords: baseCoords });
            }
            if (!merged.label && (otm as any).label) {
                merged = mergePoiPieces(merged, { label: (otm as any).label });
            }
        }
    } catch { /* ignore */ }

    if (opts.sourceFeature?.properties) {
        const p = opts.sourceFeature.properties || {};
        const osmDesc    = p.description || p["description:pt"] || null;
        const osmOH      = p.opening_hours || null;
        const osmPhone   = p.phone || p["contact:phone"] || null;
        const osmEmail   = p.email || p["contact:email"] || null;
        const osmWebsite = p.website || p["contact:website"] || null;
        const startDate  = p.start_date || null;

        const tooltipName = featurePrimaryName(opts.sourceFeature);

        pushDesc(osmDesc, "osm", { title: tooltipName || approxName || merged.label || null });
        if (osmOH) merged.openingHours = mergeOpeningHours(merged.openingHours, { raw: osmOH }) ?? merged.openingHours;
        merged.contacts = mergeContacts(merged.contacts, { phone: osmPhone ?? undefined, email: osmEmail ?? undefined, website: osmWebsite ?? undefined }) ?? merged.contacts;
        merged.website = merged.website ?? osmWebsite ?? undefined;

        if (startDate && /^\+?\d{4}(-\d{2})?(-\d{2})?$/.test(String(startDate))) {
            merged.builtPeriod = merged.builtPeriod || {};
            if (!merged.builtPeriod.start) merged.builtPeriod.start = String(startDate).replace(/^\+/, "");
            if (!merged.inception) merged.inception = String(startDate).replace(/^\+/, "");
        }

        if (tooltipName) {
            const oldLabel = merged.label ?? null;
            if (oldLabel && normStr(tooltipName) !== normStr(oldLabel)) {
                merged.oldNames = Array.from(new Set([...(merged.oldNames ?? []), oldLabel]));
            }
            merged.label = tooltipName;
        }
    }

    // Escolha final da descrição
    {
        type DescSrc = "wikidata" | "wikipedia" | "opentripmap" | "osm";
        const srcWeight: Record<DescSrc, number> = { wikipedia: 1000, opentripmap: 750, osm: 550, wikidata: 200 };
        const targetName = approxName ?? merged.label ?? null;

        const descCands: Array<{ text: string; src: DescSrc; title?: string | null; coords?: { lat: number; lon: number } | null }> = [];
        const pushDesc = (text?: string | null, src?: DescSrc, meta?: { title?: string | null; coords?: { lat: number; lon: number } | null }) => {
            const t = (text || "").trim();
            if (!t || !src) return;
            if (!descCands.some(d => d.text === t)) descCands.push({ text: t, src, title: meta?.title ?? null, coords: meta?.coords ?? null });
        };

        // já adicionámos descrições ao longo do pipeline acima

        if (merged.description && !descCands.some(d => d.text === merged.description)) {
            const inferredSrc: DescSrc = merged.wikipediaUrl ? "wikipedia"
                : merged.wikidataId ? "wikidata" : "osm";
            descCands.push({
                text: merged.description,
                src: inferredSrc,
                title: merged.label ?? targetName ?? null,
                coords: merged.coords ?? null
            });
        }

        const scored = descCands.map(c => {
            const ov = tokenOverlap(targetName, c.title ?? targetName);
            const eq = normalize(targetName) && normalize(targetName) === normalize(c.title);
            const nameBoost = (eq ? 10 : 0) + Math.round(ov * 8);
            const lengthBoost = Math.min(600, c.text.length);
            const score = (srcWeight[c.src] || 0) + lengthBoost + nameBoost * 20;
            return { ...c, score };
        }).sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best) merged.description = best.text;
    }

    // Normalização de imagens
    merged.images = normalizeImageUrls(merged.images) ?? [];
    if (merged.image) merged.image = normalizeCommonsUrl(merged.image);
    if (merged.images.length > 48) merged.images = merged.images.slice(0, 48);

    const gallery = (() => {
        const arr: string[] = [];
        const push = (s?: string | null) => {
            if (!s) return;
            const n = normalizeCommonsUrl(s);
            if (n && !arr.includes(n)) arr.push(n);
        };
        push(merged.image ?? null);
        for (const u of merged.images ?? []) push(u);
        return arr;
    })();

    const first3: string[] = [];
    for (const u of gallery) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await new Promise<boolean>((resolve) => {
            const img = new Image();
            const t = setTimeout(() => resolve(false), 8000);
            img.onload = () => { clearTimeout(t); resolve(true); };
            img.onerror = () => { clearTimeout(t); resolve(false); };
            img.src = u;
        });
        if (ok) first3.push(u);
        if (first3.length >= 3) break;
    }
    if (first3.length > 0) {
        merged.image = first3[0];
        merged.images = first3.slice(1);
    } else {
        merged.image = undefined;
        merged.images = [];
    }

    const hasAny =
        merged.label || merged.description || merged.image ||
        (merged.images && merged.images.length > 0) ||
        merged.website || merged.contacts || merged.openingHours ||
        (merged.ratings && merged.ratings.length > 0) ||
        merged.builtPeriod;

    return (hasAny ? (merged as PoiInfo) : null);
}