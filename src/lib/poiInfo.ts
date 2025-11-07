// src/lib/poiInfo.ts

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
    value: number;     // 0..5
    votes?: number | null;
};

export type PoiInfo = {
    // básicos
    label?: string | null;
    description?: string | null;
    image?: string | null;
    images?: string[];
    inception?: string | null;
    wikipediaUrl?: string | null;
    wikidataId?: string | null;

    // extra existentes
    coords?: { lat: number; lon: number } | null;
    website?: string | null;
    instanceOf?: string[];
    locatedIn?: string[];
    heritage?: string[];

    // enriquecimento
    openingHours?: OpeningHours | null;
    contacts?: Contacts | null;
    ratings?: Ratings[];           // ex: OpenTripMap
    historyText?: string | null;   // DGPC / SIPA (futuro)
    architectureText?: string | null; // DGPC / SIPA (futuro)
};

/* ===========================
   Endpoints base
   =========================== */
const WIKIDATA_ENTITY = (id: string) =>
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;

const WIKIPEDIA_SUMMARY = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

const WIKIPEDIA_MEDIA_LIST = (lang: string, title: string) =>
    `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;

const COMMONS_FILE = (fileName: string) =>
    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;

const COMMONS_API = `https://commons.wikimedia.org/w/api.php?origin=*&format=json`;
const commonsCategoryMembers = (category: string, limit = 60) =>
    `${COMMONS_API}&action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(
        category
    )}&cmnamespace=6&cmtype=file&cmlimit=${limit}`;

const WD_WBGETENTITIES = (ids: string[]) =>
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
        ids.join("|")
    )}&props=labels|claims|sitelinks&languages=pt|en&format=json&origin=*`;

// OpenTripMap
const OTM_KEY = import.meta.env.VITE_OPENTRIPMAP_KEY as string | undefined;
const OTM_BASE = "https://api.opentripmap.com/0.1";
const OTM_PLACE_BY_NAME = (lat: number, lon: number, name: string) =>
    `${OTM_BASE}/en/places/radius?radius=300&lon=${lon}&lat=${lat}&name=${encodeURIComponent(
        name
    )}&apikey=${OTM_KEY}`;
const OTM_DETAILS = (xid: string) =>
    `${OTM_BASE}/en/places/xid/${encodeURIComponent(xid)}?apikey=${OTM_KEY}`;

// Overpass (OSM profundo)
const OVERPASS = "https://overpass-api.de/api/interpreter";
const overpassQL = (q: string) => `${OVERPASS}?data=${encodeURIComponent(q)}`;

/* ===========================
   Utils
   =========================== */
function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

function firstNonEmpty<T>(...vals: (T | null | undefined)[]): T | undefined {
    for (const v of vals) {
        if (v === 0 || v === false) return v as any;
        if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) return v as T;
    }
    return undefined;
}

function pick<T = string>(obj: any, path: Array<string | number>): T | null {
    let cur: any = obj;
    for (const k of path) {
        cur = cur?.[k as any];
        if (cur == null) return null;
    }
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

/* ===========================
   Normalização de imagens (Commons)
   =========================== */
function normalizeCommonsUrl(u: string): string {
    try {
        const url = new URL(u);
        if (!/commons\.wikimedia\.org$/i.test(url.hostname)) return u;
        const p = url.pathname;

        const extractFileName = (s: string) => {
            const decoded = decodeURIComponent(s);
            const afterColon = decoded.split(":").pop() || decoded;
            return afterColon.trim();
        };

        if (/\/wiki\/Special:Redirect\/file\//i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/Special:Redirect\/file\//i, "");
            const fileName = extractFileName(filePart);
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
        }
        if (/\/wiki\/(File|Ficheiro):/i.test(p)) {
            const filePart = p.replace(/.*\/wiki\/(File|Ficheiro):/i, "");
            const fileName = extractFileName(filePart);
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
        }
        return u;
    } catch {
        return u;
    }
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
    for (const r of all) {
        if (!bySource.has(r.source)) bySource.set(r.source, r);
    }
    return Array.from(bySource.values());
}

/** Merge não-destrutivo: b complementa a */
function mergePoiPieces(a: Partial<PoiInfo>, b: Partial<PoiInfo>): Partial<PoiInfo> {
    const out: Partial<PoiInfo> = { ...a };

    // escalares
    out.label        = firstNonEmpty(a.label,        b.label)        ?? out.label;
    out.description  = firstNonEmpty(a.description,  b.description)  ?? out.description;
    out.image        = firstNonEmpty(a.image,        b.image)        ?? out.image;
    out.inception    = firstNonEmpty(a.inception,    b.inception)    ?? out.inception;
    out.wikipediaUrl = firstNonEmpty(a.wikipediaUrl, b.wikipediaUrl) ?? out.wikipediaUrl;
    out.wikidataId   = firstNonEmpty(a.wikidataId,   b.wikidataId)   ?? out.wikidataId;

    // arrays dedupe
    const imgs = normalizeImageUrls([...(a.images ?? []), ...(b.images ?? [])]);
    if (imgs && imgs.length) out.images = imgs;

    out.coords     = firstNonEmpty(a.coords,     b.coords)     ?? out.coords;
    out.website    = firstNonEmpty(a.website,    b.website)    ?? out.website;

    const inst = uniq([...(a.instanceOf ?? []), ...(b.instanceOf ?? [])]);
    if (inst.length) out.instanceOf = inst;
    const loc  = uniq([...(a.locatedIn ?? []), ...(b.locatedIn ?? [])]);
    if (loc.length) out.locatedIn = loc;
    const her  = uniq([...(a.heritage ?? []), ...(b.heritage ?? [])]);
    if (her.length) out.heritage = her;

    out.contacts      = mergeContacts(a.contacts, b.contacts) ?? out.contacts;
    out.openingHours  = mergeOpeningHours(a.openingHours, b.openingHours) ?? out.openingHours;
    const rat         = mergeRatings(a.ratings, b.ratings);
    if (rat && rat.length) out.ratings = rat;

    out.historyText       = firstNonEmpty(a.historyText,       b.historyText)       ?? out.historyText;
    out.architectureText  = firstNonEmpty(a.architectureText,  b.architectureText)  ?? out.architectureText;

    return out;
}

/* ===========================
   Wikipedia
   =========================== */
async function fetchFromWikipedia(lang: string, title: string): Promise<Partial<PoiInfo>> {
    const jd = await safeJson(WIKIPEDIA_SUMMARY(lang, title));
    const image =
        jd?.originalimage?.source ??
        jd?.thumbnail?.source ??
        null;
    return {
        label: jd?.title ?? null,
        description: jd?.extract ?? null,
        image,
        wikipediaUrl: jd?.content_urls?.desktop?.page ?? null,
    };
}

async function fetchImagesFromWikipediaMediaList(lang: string, title: string): Promise<string[]> {
    try {
        const jd = await safeJson(WIKIPEDIA_MEDIA_LIST(lang, title));
        const xs: string[] = [];
        for (const item of jd?.items ?? []) {
            if (item?.type === "image" && item?.title) {
                xs.push(COMMONS_FILE(item.title.replace(/^File:/i, "")));
            }
        }
        return xs;
    } catch {
        return [];
    }
}

/* ===========================
   Commons
   =========================== */
async function fetchImagesFromCommonsCategory(category: string): Promise<string[]> {
    try {
        const jd = await safeJson(commonsCategoryMembers(category, 60));
        const files = jd?.query?.categorymembers ?? [];
        return files
            .map((f: any) => f?.title?.replace(/^File:/i, ""))
            .filter(Boolean)
            .map((fn: string) => COMMONS_FILE(fn));
    } catch {
        return [];
    }
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
    const p373 = claimString(entity, "P373"); // Commons category
    return p373 || null;
}

async function fetchExtraFromWikidata(entity: any): Promise<Partial<PoiInfo>> {
    const coord = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const coords = coord ? { lat: coord.latitude, lon: coord.longitude } : null;
    const website = claimString(entity, "P856");

    const p31   = claimEntityIds(entity, "P31");    // instance of
    const p131  = claimEntityIds(entity, "P131");   // located in
    const p1435 = claimEntityIds(entity, "P1435");  // heritage designation

    const labels = await fetchLabels([...p31, ...p131, ...p1435]);
    return {
        coords,
        website,
        instanceOf: p31.map(q => labels[q] || q),
        locatedIn:  p131.map(q => labels[q] || q),
        heritage:   p1435.map(q => labels[q] || q),
    };
}

export async function fetchFromWikidata(id: string): Promise<{ entity?: any } & Partial<PoiInfo>> {
    const jd = await safeJson(WIKIDATA_ENTITY(id));
    const entity = jd?.entities?.[id];
    if (!entity) return {};

    const label =
        entity?.labels?.pt?.value ??
        entity?.labels?.en?.value ??
        null;

    const description =
        entity?.descriptions?.pt?.value ??
        entity?.descriptions?.en?.value ??
        null;

    const imageName =
        pick<string>(entity, ["claims", "P18", 0, "mainsnak", "datavalue", "value"]) ?? null;

    const inceptionRaw =
        pick<string>(entity, ["claims", "P571", 0, "mainsnak", "datavalue", "value", "time"]) ?? null;
    const inception = inceptionRaw ? inceptionRaw.replace(/^\+/, "").slice(0, 10) : null;

    const extra = await fetchExtraFromWikidata(entity);

    return {
        entity,
        wikidataId: id,
        label,
        description,
        image: imageName ? COMMONS_FILE(imageName) : null,
        inception,
        ...extra,
    };
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
      out tags center;
    `;
    } else if (opts.wikidata) {
        q = `
      [out:json][timeout:25];
      (
        node["wikidata"="${opts.wikidata}"];
        way["wikidata"="${opts.wikidata}"];
        relation["wikidata"="${opts.wikidata}"];
      );
      out tags center;
    `;
    } else if (opts.coords && opts.name) {
        const { lat, lon } = opts.coords;
        const name = opts.name.replace(/"/g, '\\"');
        // name / official_name / alt_name num raio 350m
        q = `
      [out:json][timeout:25];
      (
        node(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
        way(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
        relation(around:350,${lat},${lon})[~"^(name|official_name|alt_name)$"~"${name}", i];
      );
      out tags center;
    `;
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

        const openingHours: OpeningHours | null = tags["opening_hours"]
            ? { raw: tags["opening_hours"] }
            : null;

        return {
            contacts: (contacts.phone || contacts.email || contacts.website) ? contacts : undefined,
            openingHours: openingHours ?? undefined,
            website: contacts.website ?? undefined,
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
        // rating (0..5)
        const ratingVal = Number(det?.rate ?? 0);
        const images: string[] = (det?.preview?.source ? [det.preview.source] : [])
            .concat(
                (det?.images ?? []).map((im: any) => im?.preview || im?.source).filter(Boolean)
            );

        const ratings: Ratings[] =
            isFinite(ratingVal) && ratingVal > 0
                ? [{ source: "opentripmap", value: Math.min(5, Math.max(0, ratingVal)), votes: det?.wikidata ? null : null }]
                : [];

        return {
            ratings,
            images,
            // OTM às vezes devolve um “wikipedia_extracts”
            description: det?.wikipedia_extracts?.text || undefined,
        };
    } catch {
        return {};
    }
}

/* ===========================
   DGPC / SIPA (placeholder)
   =========================== */
export async function fetchFromPortugueseHeritage(_opts: {
    sipaId?: string | null;
    monumentosUrl?: string | null;
}): Promise<Partial<PoiInfo>> {
    // TODO: implementar scraping/API quando disponível (história/arquitetura)
    return {
        historyText: null,
        architectureText: null,
    };
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

    // 1) Wikidata
    let wdEntity: any = null;
    if (opts.wikidata) {
        try {
            const wd = await fetchFromWikidata(opts.wikidata);
            wdEntity = wd.entity ?? null;
            delete (wd as any).entity;
            merged = mergePoiPieces(merged, wd);
        } catch {}
    }

    // 2) Wikipedia (+ media-list)
    const wpTag = parseWikipediaTag(opts.wikipedia ?? null);
    if (wpTag) {
        try {
            const wp = await safeJson(WIKIPEDIA_SUMMARY(wpTag.lang, wpTag.title));
            const wpPiece: Partial<PoiInfo> = {
                label: wp?.title ?? null,
                description: wp?.extract ?? null,
                image: wp?.originalimage?.source ?? wp?.thumbnail?.source ?? null,
                wikipediaUrl: wp?.content_urls?.desktop?.page ?? null,
            };
            const mediaImgs = await fetchImagesFromWikipediaMediaList(wpTag.lang, wpTag.title);
            merged = mergePoiPieces(merged, { ...wpPiece, images: mediaImgs });
        } catch {
            if (wpTag.lang !== "en") {
                try {
                    const wp = await safeJson(WIKIPEDIA_SUMMARY("en", wpTag.title));
                    const wpPiece: Partial<PoiInfo> = {
                        label: wp?.title ?? null,
                        description: wp?.extract ?? null,
                        image: wp?.originalimage?.source ?? wp?.thumbnail?.source ?? null,
                        wikipediaUrl: wp?.content_urls?.desktop?.page ?? null,
                    };
                    const mediaImgsEn = await fetchImagesFromWikipediaMediaList("en", wpTag.title);
                    merged = mergePoiPieces(merged, { ...wpPiece, images: mediaImgsEn });
                } catch {}
            }
        }
    }

    // 3) Commons category (via WD)
    if (wdEntity) {
        const cat = commonsCategoryFromWikidata(wdEntity);
        if (cat) {
            const commonsImgs = await fetchImagesFromCommonsCategory(cat);
            if (commonsImgs.length) merged = mergePoiPieces(merged, { images: commonsImgs });
        }
    }

    // 4) OSM profundo (contacts/opening_hours/website)
    try {
        const osmExtra = await fetchFromOSMDeep({
            osmId: opts.osmId ?? null,
            wikidata: opts.wikidata ?? null,
            coords:
                opts.approx?.lat != null && opts.approx?.lon != null
                    ? { lat: opts.approx.lat!, lon: opts.approx.lon! }
                    : null,
            name: opts.approx?.name ?? merged.label ?? null,
        });
        merged = mergePoiPieces(merged, osmExtra);
    } catch {}

    // 5) OpenTripMap (ratings + fotos + poss. descrição curta)
    try {
        const baseName = opts.approx?.name ?? merged.label ?? null;
        const baseCoords =
            merged.coords ??
            (opts.approx?.lat != null && opts.approx?.lon != null
                ? { lat: opts.approx.lat!, lon: opts.approx.lon! }
                : null);

        if (OTM_KEY && baseName && baseCoords) {
            const otm = await fetchFromOpenTripMap(baseName, baseCoords.lat, baseCoords.lon);
            merged = mergePoiPieces(merged, otm);
        }
    } catch {}

    // 6) DGPC/SIPA (no futuro)
    // if (ids) merged = mergePoiPieces(merged, await fetchFromPortugueseHeritage(...));

    // Normalização final
    merged.images = normalizeImageUrls(merged.images) ?? [];
    if (merged.image) merged.image = normalizeCommonsUrl(merged.image);
    if (merged.images.length > 48) merged.images = merged.images.slice(0, 48);

    const hasAny =
        merged.label ||
        merged.description ||
        merged.image ||
        (merged.images && merged.images.length > 0) ||
        merged.website ||
        merged.contacts ||
        merged.openingHours ||
        (merged.ratings && merged.ratings.length > 0);

    if (!hasAny) return merged.wikidataId ? (merged as PoiInfo) : null;

    return merged as PoiInfo;
}