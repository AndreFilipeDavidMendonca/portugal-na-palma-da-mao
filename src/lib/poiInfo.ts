// src/lib/poiInfo.ts
import type { PoiCategory } from "@/utils/constants";

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
    // ✅ novos (para permissões / navegação / debug)
    id?: number | null;
    ownerId?: string | null;
    source?: string | null;

    // ✅ categoria normalizada (inclui comerciais)
    category?: PoiCategory | null;

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
   HELPERS
   ===================================================================== */

function cleanString(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t : null;
}

function asStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const it of v) {
        const s = cleanString(it);
        if (s) out.push(s);
    }
    return out;
}

function uniqStrings(arr: string[]): string[] {
    return Array.from(new Set(arr));
}

function asNumber(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function hasAnyUsefulField(p: Partial<PoiInfo>): boolean {
    return !!(
        p.label ||
        p.description ||
        p.image ||
        (p.images && p.images.length > 0) ||
        p.website ||
        p.contacts ||
        p.openingHours ||
        (p.ratings && p.ratings.length > 0)
    );
}

function extractCoords(sourceFeature: any, approx?: { lat?: number | null; lon?: number | null } | null) {
    const geom = sourceFeature?.geometry ?? null;

    if (geom && geom.type === "Point" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        const lon = asNumber(geom.coordinates[0]);
        const lat = asNumber(geom.coordinates[1]);
        if (lat != null && lon != null) return { lat, lon };
    }

    const lat = approx?.lat ?? null;
    const lon = approx?.lon ?? null;
    if (typeof lat === "number" && typeof lon === "number") return { lat, lon };

    return null;
}

// ✅ Normalização categoria (PT -> key)
const COMMERCIAL_MAP_PT: Record<string, PoiCategory> = {
    Gastronomia: "gastronomy",
    Artesanato: "crafts",
    Alojamento: "accommodation",
    Evento: "event",
};

const ALL_KEYS: ReadonlySet<string> = new Set([
    "castle",
    "palace",
    "monument",
    "ruins",
    "church",
    "viewpoint",
    "park",
    "trail",
    "gastronomy",
    "crafts",
    "accommodation",
    "event",
]);

function normalizePoiCategory(raw: unknown): PoiCategory | null {
    const s = cleanString(raw);
    if (!s) return null;

    if (ALL_KEYS.has(s)) return s as PoiCategory;
    if (COMMERCIAL_MAP_PT[s]) return COMMERCIAL_MAP_PT[s];

    return null;
}

/* =====================================================================
   ORQUESTRADOR: fetchPoiInfo
   ===================================================================== */

type FetchPoiInfoOpts = {
    wikipedia?: string | null;
    approx?: {
        name?: string | null;
        lat?: number | null;
        lon?: number | null;
    } | null;
    sourceFeature?: any | null;
};

/**
 * Serve para criar uma base rápida (BD/GeoJSON) e deixar o Wikimedia para o DistrictModal.
 */
export async function fetchPoiInfo(options: FetchPoiInfoOpts): Promise<PoiInfo | null> {
    const sourceFeature = options.sourceFeature || null;
    const approx = options.approx || null;

    if (!sourceFeature) return null;

    const props = sourceFeature.properties ?? {};

    const coords = extractCoords(sourceFeature, approx);

    // IDs / permissões (comerciais)
    const id = asNumber(props.id);
    const ownerId = cleanString(props.ownerId) ?? cleanString(props.owner_id) ?? null;
    const source = cleanString(props.source);

    // ✅ categoria normalizada (inclui comerciais)
    const category = normalizePoiCategory(props.category);

    const label =
        cleanString(props["name:pt"]) ??
        cleanString(props.namePt) ??
        cleanString(props.name) ??
        cleanString(approx?.name) ??
        null;

    // imagens da BD (GeoJSON)
    const dbImages = asStringArray(props.images);

    const mainImageFromProps =
        cleanString(props.image) ??
        (dbImages.length > 0 ? dbImages[0] : null);

    const mergedImages = uniqStrings([
        ...(mainImageFromProps ? [mainImageFromProps] : []),
        ...dbImages,
    ]);

    const finalImage = mergedImages.length > 0 ? mergedImages[0] : null;

    // Contacts
    const phone = cleanString(props.phone);
    const email = cleanString(props.email);
    const website = cleanString(props.website);

    const contacts: Contacts | null = phone || email || website ? { phone, email, website } : null;

    const poi: Partial<PoiInfo> = {
        id,
        ownerId,
        source,

        category,

        label,
        description: cleanString(props.description) ?? null,

        image: finalImage,
        images: mergedImages,

        coords,

        wikipediaUrl: cleanString(props.wikipediaUrl) ?? null,
        wikidataId: cleanString(props.wikidataId) ?? null,

        website,
        contacts,

        historyText: cleanString(props.historyText) ?? null,
        architectureText: cleanString(props.architectureText) ?? null,

        architects: Array.isArray(props.architects) ? asStringArray(props.architects) : undefined,
        architectureStyles: Array.isArray(props.architectureStyles) ? asStringArray(props.architectureStyles) : undefined,
        materials: Array.isArray(props.materials) ? asStringArray(props.materials) : undefined,
        builders: Array.isArray(props.builders) ? asStringArray(props.builders) : undefined,

        builtPeriod: props.builtPeriod ?? undefined,
        openingHours: props.openingHours ?? null,
        ratings: Array.isArray(props.ratings) ? props.ratings : undefined,
    };

    if (!hasAnyUsefulField(poi)) return null;
    return poi as PoiInfo;
}