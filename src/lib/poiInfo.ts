// src/lib/poiInfo.ts

/* ===========================
   Debug helpers
   =========================== */
const DEBUG_POI = (() => {
    try {
        if (import.meta.env?.VITE_DEBUG_POI === "true") return true;
        return new URLSearchParams(window.location.search).get("debug") === "poi";
    } catch {
        return false;
    }
})();
const dlog = (...args: any[]) => { if (DEBUG_POI) console.log("[POI]", ...args); };
const dgrp = (title: string) => { if (DEBUG_POI) console.groupCollapsed(title); };
const dgrpEnd = () => { if (DEBUG_POI) console.groupEnd(); };

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
    source: "opentripmap";
    value: number; // 0..5
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

    openingHours?: OpeningHours | null;
    contacts?: Contacts | null;
    ratings?: Ratings[];
    historyText?: string | null;
    architectureText?: string | null;

    architects?: string[];
    architectureStyles?: string[];
    materials?: string[];

    // NOVO
    builders?: string[];        // fundador/criador/empreiteiro/mecenas + arquitetos
    builtPeriod?: BuiltPeriod;  // janelas temporais mais ricas
};

/* ===========================
   Endpoints
   =========================== */
const WIKIDATA_ENTITY = (id: string) =>
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
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
// sections (HTML) via action=parse
const WIKIPEDIA_PARSE = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections|text&format=json&origin=*`;

const COMMONS_FILE = (fileName: string) =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
const COMMONS_API = `https://commons.wikimedia.org/w/api.php?origin=*&format=json`;
const commonsCategoryMembers = (category: string, limit = 60) =>
    `${COMMONS_API}&action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmnamespace=6&cmtype=file&cmlimit=${limit}`;
const COMMONS_GEOSEARCH = (lat: number, lon: number, radius = 800) =>
    `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=50&format=json&origin=*`;

const WD_WBGETENTITIES = (ids: string[]) =>
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(ids.join("|"))}&props=labels|claims|sitelinks&languages=pt|en&format=json&origin=*`;

// OpenTripMap
const OTM_KEY = import.meta.env.VITE_OPENTRIPMAP_KEY as string | undefined;
const OTM_BASE = "https://api.opentripmap.com/0.1";
const OTM_PLACE_BY_NAME = (lat: number, lon: number, name: string) =>
    `${OTM_BASE}/en/places/radius?radius=300&lon=${lon}&lat=${lat}&name=${encodeURIComponent(name)}&apikey=${OTM_KEY}`;
const OTM_DETAILS = (xid: string) =>
    `${OTM_BASE}/en/places/xid/${encodeURIComponent(xid)}?apikey=${OTM_KEY}`;

// Overpass
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
function pick<T = string>(obj: any, path: Array<string | number>): T | null {
    let cur: any = obj;
    for (const k of path) { cur = cur?.[k as any]; if (cur == null) return null; }
    return cur as T;
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
async function safeJson(url: string) {
    const r = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}
function htmlToText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    // junta parágrafos visíveis
    const ps = Array.from(doc.querySelectorAll("p"));
    return ps.map(p => p.textContent?.trim() || "").filter(Boolean).join("\n\n");
}
function normalizeDateISO(iso?: string | null): string | null {
    if (!iso) return null;
    return iso.replace(/^\+/, "").slice(0, 10); // +1160-00-00 → 1160-00-00 → 1160-00-00
}

/* Heurística de tipo pelo nome (ajuda no ranking de pesquisas) */
function typeHintFromName(name?: string | null): "viewpoint" | "church" | "ruins" | null {
    if (!name) return null;
    const n = name.toLowerCase();
    if (/miradouro|viewpoint|mirador/.test(n)) return "viewpoint";
    if (/igreja|church|sé|catedral|mosteiro|convento|capela/.test(n)) return "church";
    if (/ru[ií]nas?|castro/.test(n)) return "ruins";
    return null;
}
function scoreByNameAndType(
    label: string, desc: string | undefined, name: string,
    hint: ReturnType<typeof typeHintFromName>
) {
    let s = 0;
    const lab = (label || "").toLowerCase();
    const d = (desc || "").toLowerCase();
    const q = name.toLowerCase();
    if (lab === q) s += 6; else if (lab.includes(q)) s += 3;
    if (d.includes("portugal")) s += 2;
    if (hint === "viewpoint" && /viewpoint|miradouro/.test(lab + " " + d)) s += 2;
    if (hint === "church" && /church|igreja|cathedral|sé|monastery|convent|chapel/.test(lab + " " + d)) s += 2;
    if (hint === "ruins" && /ruins|ru[ií]nas|castro/.test(lab + " " + d)) s += 2;
    return s;
}

/* ===========================
   Geodistance helpers
   =========================== */
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}
function isFar(a?: { lat: number; lon: number } | null, b?: { lat: number; lon: number } | null, maxKm = 60) {
    if (!a || !b) return false;
    return haversineKm(a, b) > maxKm;
}

/* ===========================
   Commons normalization
   =========================== */
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

    // NOVO: builders e builtPeriod
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
   Wikipedia (summary + media)
   =========================== */
async function fetchFromWikipedia(lang: string, title: string): Promise<Partial<PoiInfo>> {
    const jd = await safeJson(WIKIPEDIA_SUMMARY(lang, title));
    const image = jd?.originalimage?.source ?? jd?.thumbnail?.source ?? null;
    return {
        label: jd?.title ?? null,
        description: jd?.extract ?? null,
        image,
        wikipediaUrl: jd?.content_urls?.desktop?.page ?? null,
    };
}

/** Versão strict: rejeita artigos da Wikipédia longe do POI (se tivermos coords). */
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

    if (approx && wpCoords && isFar(approx, wpCoords, maxKm)) {
        dlog("Wikipedia strict: descartado por distância", { approx, wpCoords });
        return {};
    }

    const image = jd?.originalimage?.source ?? jd?.thumbnail?.source ?? null;
    const out: Partial<PoiInfo> = {
        label: jd?.title ?? null,
        description: jd?.extract ?? null,
        image,
        wikipediaUrl: jd?.content_urls?.desktop?.page ?? null,
    };
    if (wpCoords) out.coords = out.coords ?? wpCoords;
    return out;
}

async function fetchImagesFromWikipediaMediaList(lang: string, title: string): Promise<string[]> {
    try {
        const jd = await safeJson(WIKIPEDIA_MEDIA_LIST(lang, title));
        const xs: string[] = [];
        for (const item of jd?.items ?? []) {
            if (item?.type === "image" && item?.title) xs.push(COMMONS_FILE(item.title.replace(/^File:/i, "")));
        }
        return xs;
    } catch { return []; }
}

/* Wikipedia: secções História/Arquitetura (PT→EN fallback) */
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
            // recolher heading -> content
            const sections: Record<string, string> = {};
            let current = "";
            const nodes = Array.from(doc.body.childNodes);
            const push = (k: string, v: string) => {
                sections[k] = (sections[k] || "") + v;
            };

            for (const n of nodes) {
                if (n.nodeType === 1) {
                    const el = n as HTMLElement;
                    if (/^H[2-4]$/.test(el.tagName)) {
                        current = (el.textContent || "").trim().toLowerCase();
                        continue;
                    }
                    if (current && (el.tagName === "P" || el.tagName === "UL" || el.tagName === "OL")) {
                        push(current, el.outerHTML);
                    }
                }
            }

            const getFirstParas = (keyList: string[]) => {
                for (const k of keyList) {
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
    const en = await tryLang("en");
    return en;
}

/* Wikipedia: title search & geo */
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
async function geosearchWikipediaTitle(lat: number, lon: number) {
    const tryLang = async (lang: string) => {
        try {
            const jd = await safeJson(WIKIPEDIA_GEOSEARCH(lang, lat, lon));
            const hit = jd?.query?.geosearch?.[0];
            if (!hit?.title) return null;
            return { lang, title: hit.title as string };
        } catch { return null; }
    };
    return (await tryLang("pt")) || (await tryLang("en"));
}

/* ===========================
   Commons
   =========================== */
async function fetchImagesFromCommonsCategory(category: string): Promise<string[]> {
    try {
        const jd = await safeJson(commonsCategoryMembers(category, 60));
        const files = jd?.query?.categorymembers ?? [];
        return files.map((f: any) => f?.title?.replace(/^File:/i, "")).filter(Boolean).map((fn: string) => COMMONS_FILE(fn));
    } catch { return []; }
}
async function geosearchCommonsImages(lat: number, lon: number): Promise<string[]> {
    try {
        const jd = await safeJson(COMMONS_GEOSEARCH(lat, lon));
        const items = jd?.query?.geosearch ?? [];
        return items
            .map((it: any) => it?.title as string)
            .filter(Boolean)
            .map((t: any) => t.replace(/^File:/i, ""))
            .map((fn: any) => COMMONS_FILE(fn));
    } catch { return []; }
}

/* ===========================
   Wikidata
   =========================== */
function claimEntityIds(entity: any, prop: string): string[] {
    const arr = entity?.claims?.[prop] ?? [];
    const ids: string[] = [];
    for (const c of arr) {
        const id = c?.mainsnak?.datavalue?.value?.id;
        if (id) ids.push(id);
    }
    return ids;
}
function claimString(entity: any, prop: string): string | null {
    return entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value ?? null;
}
async function fetchLabels(qids: string[]): Promise<Record<string, string>> {
    if (!qids.length) return {};
    const r = await safeJson(WD_WBGETENTITIES(qids));
    const ents = r?.entities ?? {};
    const out: Record<string, string> = {};
    for (const [qid, e] of Object.entries<any>(ents)) {
        out[qid] = e?.labels?.pt?.value ?? e?.labels?.en?.value ?? qid;
    }
    return out;
}
function commonsCategoryFromWikidata(entity: any): string | null {
    const p373 = claimString(entity, "P373");
    return p373 || null;
}

async function fetchExtraFromWikidata(entity: any): Promise<Partial<PoiInfo>> {
    const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const coords = coord ? { lat: coord.latitude, lon: coord.longitude } : null;
    const website = claimString(entity, "P856");

    const p31   = claimEntityIds(entity, "P31");   // instance of
    const p131  = claimEntityIds(entity, "P131");  // located in
    const p1435 = claimEntityIds(entity, "P1435"); // heritage

    // Arquitetura / autores / construtores
    const p84   = claimEntityIds(entity, "P84");   // architect
    const p112  = claimEntityIds(entity, "P112");  // founder
    const p170  = claimEntityIds(entity, "P170");  // creator
    const p193  = claimEntityIds(entity, "P193");  // main building contractor
    const p859  = claimEntityIds(entity, "P859");  // sponsor/patron

    // Datas
    const inceptionRaw = pick<string>(entity, ["claims","P571",0,"mainsnak","datavalue","value","time"]); // inception
    const openedRaw    = pick<string>(entity, ["claims","P1619",0,"mainsnak","datavalue","value","time"]); // official opening
    const earliestRaw  = pick<string>(entity, ["claims","P1319",0,"mainsnak","datavalue","value","time"]); // earliest date
    const latestRaw    = pick<string>(entity, ["claims","P1326",0,"mainsnak","datavalue","value","time"]); // latest date

    const labels = await fetchLabels([...p31, ...p131, ...p1435, ...p84, ...p112, ...p170, ...p193, ...p859]);

    const architects = p84.map(q => labels[q] || q);
    const buildersExtra = [
        ...p112.map(q => labels[q] || q),
        ...p170.map(q => labels[q] || q),
        ...p193.map(q => labels[q] || q),
        ...p859.map(q => labels[q] || q),
    ];

    const builtPeriod: BuiltPeriod = {
        start:  normalizeDateISO(earliestRaw || inceptionRaw || null),
        end:    normalizeDateISO(latestRaw || null),
        opened: normalizeDateISO(openedRaw || null),
    };

    return {
        coords,
        website,
        instanceOf: p31.map(q => labels[q] || q),
        locatedIn:  p131.map(q => labels[q] || q),
        heritage:   p1435.map(q => labels[q] || q),
        architects,
        architectureStyles: claimEntityIds(entity, "P149").map(q => labels[q] || q),
        materials:  claimEntityIds(entity, "P186").map(q => labels[q] || q),
        builders:   uniq([...architects, ...buildersExtra]),
        builtPeriod,
        // manter também inception old-style para compat (string yyyy-mm-dd)
        inception: normalizeDateISO(inceptionRaw || null),
    };
}

export async function fetchFromWikidata(id: string): Promise<{ entity?: any } & Partial<PoiInfo>> {
    const jd = await safeJson(WIKIDATA_ENTITY(id));
    const entity = jd?.entities?.[id];
    if (!entity) return {};

    const label =
        entity?.labels?.pt?.value ??
        entity?.labels?.en?.value ?? null;
    const description =
        entity?.descriptions?.pt?.value ??
        entity?.descriptions?.en?.value ?? null;

    const imageName = pick<string>(entity, ["claims", "P18", 0, "mainsnak", "datavalue", "value"]) ?? null;

    const extra = await fetchExtraFromWikidata(entity);

    return {
        entity,
        wikidataId: id,
        label, description,
        image: imageName ? COMMONS_FILE(imageName) : null,
        ...extra,
    };
}

/* Wikidata: resolver QID por nome */
async function searchWikidataIdByName(name: string) {
    try {
        const pt = await safeJson(WIKIDATA_SEARCH(name, "pt"));
        const en = await safeJson(WIKIDATA_SEARCH(name, "en"));
        const all: any[] = [...(pt?.search ?? []), ...(en?.search ?? [])];
        if (!all.length) return null;
        const hint = typeHintFromName(name);
        all.sort((a, b) => {
            const sa = scoreByNameAndType(a?.label || "", a?.description, name, hint);
            const sb = scoreByNameAndType(b?.label || "", b?.description, name, hint);
            return sb - sa;
        });
        return all[0]?.id ?? null;
    } catch { return null; }
}

/* ===========================
   OSM profundo via Overpass
   =========================== */
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
    } else {
        return {};
    }

    try {
        const jd = await safeJson(overpassQL(q));
        const el = jd?.elements?.[0];
        const tags = el?.tags ?? {};

        const contacts: Contacts = {
            phone: tags["phone"] || tags["contact:phone"] || null,
            email: tags["email"] || tags["contact:email"] || null,
            website: tags["website"] || tags["contact:website"] || null,
        };
        const openingHours: OpeningHours | null = tags["opening_hours"] ? { raw: tags["opening_hours"] } : null;

        // NOVO: descrição direta do OSM (se existir)
        const description: string | undefined = tags["description"] || undefined;

        // NOVO: builtPeriod a partir de start_date
        let builtPeriod: PoiInfo["builtPeriod"] | undefined;
        const sd = tags["start_date"] || null;
        if (sd) {
            const s = String(sd).trim();

            // intervalo YYYY-YYYY (tolerando YYYY-MM(-DD))
            const mRange = s.match(/^(\d{3,4})(?:-\d{2})?-(\d{3,4})(?:-\d{2})?(?:-\d{2})?$/);
            if (mRange) {
                builtPeriod = { start: mRange[1], end: mRange[2] };
            } else {
                const mPlus = s.match(/^(\d{3,4})\+$/);
                if (mPlus) {
                    builtPeriod = { start: mPlus[1] };
                } else {
                    const mDate = s.match(/^(\d{3,4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
                    if (mDate) {
                        const [_, y, m, d] = mDate;
                        builtPeriod = {
                            start: y && m && d ? `${y}-${m}-${d}` : y && m ? `${y}-${m}` : y || undefined,
                        };
                    }
                }
            }
        }

        return {
            contacts: (contacts.phone || contacts.email || contacts.website) ? contacts : undefined,
            openingHours: openingHours ?? undefined,
            website: contacts.website ?? undefined,
            description,   // ← agora devolvemos a descrição do OSM
            builtPeriod,   // ← e a janela temporal derivada do start_date
        };
    } catch {
        return {};
    }
}
/* ===========================
   OpenTripMap
   =========================== */
export async function fetchFromOpenTripMap(name: string, lat: number, lon: number): Promise<Partial<PoiInfo>> {
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
                ? [{ source: "opentripmap", value: Math.min(5, Math.max(0, ratingVal)), votes: det?.wikidata ? null : null }]
                : [];

        return {
            ratings,
            images,
            description: det?.wikipedia_extracts?.text || undefined,
        };
    } catch {
        return {};
    }
}

/* ===========================
   DGPC / SIPA (placeholder)
   =========================== */
export async function fetchFromPortugueseHeritage(_opts: { sipaId?: string | null; monumentosUrl?: string | null; }): Promise<Partial<PoiInfo>> {
    return { historyText: null, architectureText: null };
}

/* ===========================
   Orquestrador
   =========================== */
export async function fetchPoiInfo(opts: {
    wikidata?: string | null;
    wikipedia?: string | null;
    osmId?: string | null;
    approx?: { name?: string | null; lat?: number | null; lon?: number | null } | null;
}): Promise<PoiInfo | null> {
    let merged: Partial<PoiInfo> = { images: [] };

    dgrp("fetchPoiInfo()");
    dlog("opts:", opts);

    // Resolver por nome/coords (antes de tudo)
    let wdId = opts.wikidata ?? null;
    let wpResolved: { lang: string; title: string } | null = null;

    const approxName = opts.approx?.name ?? null;
    const approxLat = opts.approx?.lat ?? null;
    const approxLon = opts.approx?.lon ?? null;
    const approxCoords = (approxLat != null && approxLon != null)
        ? { lat: approxLat!, lon: approxLon! }
        : null;

    if (!wdId && approxName) {
        wdId = await searchWikidataIdByName(approxName);
        if (wdId) dlog("Wikidata resolved by name:", wdId);
    }
    if (!opts.wikipedia && approxName) {
        wpResolved = await searchWikipediaTitleByName(approxName);
        if (!wpResolved && approxLat != null && approxLon != null) {
            wpResolved = await geosearchWikipediaTitle(approxLat!, approxLon!);
        }
        if (wpResolved) dlog("Wikipedia resolved:", wpResolved);
    }

    // 1) Wikidata
    let wdEntity: any = null;
    if (wdId) {
        try {
            const wd = await fetchFromWikidata(wdId);
            wdEntity = wd.entity ?? null;
            dgrp("Wikidata result");
            dlog(wd);
            dgrpEnd();
            delete (wd as any).entity;
            merged = mergePoiPieces(merged, wd);

            // Filtro de distância para WD (se WD tiver coords e forem longe)
            if (approxCoords && merged.coords && isFar(approxCoords, merged.coords, 60)) {
                dlog("Wikidata descartado por distância → limpar campos sensíveis");
                merged.coords = undefined;
                merged.instanceOf = undefined;
                merged.locatedIn = undefined;
                merged.heritage = undefined;
            }
        } catch (e) { dlog("Wikidata error:", e); }
    }

    // 2) Wikipedia (summary + media) — strict geográfico
    let wpTag = parseWikipediaTag(opts.wikipedia ?? null) || wpResolved || null;
    if (wpTag) {
        try {
            const wp = await fetchFromWikipediaStrict(wpTag.lang, wpTag.title, approxCoords, 60);
            if (Object.keys(wp).length) {
                const mediaImgs = await fetchImagesFromWikipediaMediaList(wpTag.lang, wpTag.title);
                merged = mergePoiPieces(merged, { ...wp, images: mediaImgs });

                // 2.1) Secções História/Arquitetura
                const sections = await fetchWikipediaSections(wpTag.lang, wpTag.title);
                merged = mergePoiPieces(merged, {
                    historyText: sections.history ?? undefined,
                    architectureText: sections.architecture ?? undefined,
                });
            } else {
                dlog("Wikipedia strict descartado por distância");
            }
        } catch (e) {
            dlog("Wikipedia primary failed:", e);
            if (wpTag.lang !== "en") {
                try {
                    const wp = await fetchFromWikipediaStrict("en", wpTag.title, approxCoords, 60);
                    if (Object.keys(wp).length) {
                        const mediaImgsEn = await fetchImagesFromWikipediaMediaList("en", wpTag.title);
                        merged = mergePoiPieces(merged, { ...wp, images: mediaImgsEn });

                        const sectionsEn = await fetchWikipediaSections("en", wpTag.title);
                        merged = mergePoiPieces(merged, {
                            historyText: sectionsEn.history ?? undefined,
                            architectureText: sectionsEn.architecture ?? undefined,
                        });
                    } else {
                        dlog("Wikipedia EN strict descartado por distância");
                    }
                } catch (e2) { dlog("Wikipedia EN fallback error:", e2); }
            }
        }
    }

    // 3) Commons via WD
    if (wdEntity) {
        const cat = commonsCategoryFromWikidata(wdEntity);
        if (cat) {
            const commonsImgs = await fetchImagesFromCommonsCategory(cat);
            if (commonsImgs.length) merged = mergePoiPieces(merged, { images: commonsImgs });
        }
    }

    // 3.1) Commons geosearch (caso haja poucas imagens)
    if ((merged.images?.length ?? 0) < 3) {
        const baseCoords =
            merged.coords ??
            (approxLat != null && approxLon != null ? { lat: approxLat!, lon: approxLon! } : null);
        if (baseCoords) {
            const nearImgs = await geosearchCommonsImages(baseCoords.lat, baseCoords.lon);
            if (nearImgs.length) merged = mergePoiPieces(merged, { images: nearImgs });
        }
    }

    // 4) OSM Deep
    try {
        const osmExtra = await fetchFromOSMDeep({
            osmId: opts.osmId ?? null,
            wikidata: wdId ?? null,
            coords:
                merged.coords ??
                (approxLat != null && approxLon != null ? { lat: approxLat!, lon: approxLon! } : null),
            name: approxName ?? merged.label ?? null,
        });
        merged = mergePoiPieces(merged, osmExtra);
    } catch (e) { dlog("Overpass error:", e); }

    // 5) OpenTripMap
    try {
        const baseName = approxName ?? merged.label ?? null;
        const baseCoords =
            merged.coords ??
            (approxLat != null && approxLon != null ? { lat: approxLat!, lon: approxLon! } : null);
        if (OTM_KEY && baseName && baseCoords) {
            const otm = await fetchFromOpenTripMap(baseName, baseCoords.lat, baseCoords.lon);
            merged = mergePoiPieces(merged, otm);
        }
    } catch (e) { dlog("OpenTripMap error:", e); }

    // Normalização final
    merged.images = normalizeImageUrls(merged.images) ?? [];
    if (merged.image) merged.image = normalizeCommonsUrl(merged.image);
    if (merged.images.length > 48) merged.images = merged.images.slice(0, 48);

    const hasAny =
        merged.label || merged.description || merged.image ||
        (merged.images && merged.images.length > 0) ||
        merged.website || merged.contacts || merged.openingHours ||
        (merged.ratings && merged.ratings.length > 0) ||
        (merged.architects && merged.architects.length > 0) ||
        (merged.architectureStyles && merged.architectureStyles.length > 0) ||
        (merged.materials && merged.materials.length > 0) ||
        (merged.builders && merged.builders.length > 0) ||
        merged.builtPeriod;

    if (!hasAny) return merged.wikidataId ? (merged as PoiInfo) : null;
    return merged as PoiInfo;
}