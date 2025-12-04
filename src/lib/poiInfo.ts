// src/lib/poiInfo.ts

// -------------------------------------------------------------------
// Fonte ÚNICA de dados: GeoJSON vindo do backend .pt
//   - o feature já traz: nome, descrição, imagens, wikipedia, contactos, etc.
//   - aqui só fazemos o mapeamento -> PoiInfo
// -------------------------------------------------------------------

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
   HELPERS
   ===================================================================== */

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

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

/* =====================================================================
   ORQUESTRADOR: fetchPoiInfo
   ===================================================================== */

export async function fetchPoiInfo(options: {
    wikipedia?: string | null; // mantido só para compatibilidade
    approx?: { name?: string | null; lat?: number | null; lon?: number | null } | null;
    sourceFeature?: any | null;
}): Promise<PoiInfo | null> {
    const sourceFeature = options.sourceFeature || null;
    const approx = options.approx || null;

    if (!sourceFeature) return null;

    const props = sourceFeature.properties ?? {};
    const geom = sourceFeature.geometry ?? null;

    // ----------------------------------------
    // Coords: geometry → approx
    // ----------------------------------------
    let coords: { lat: number; lon: number } | null = null;

    if (
        geom &&
        geom.type === "Point" &&
        Array.isArray(geom.coordinates) &&
        geom.coordinates.length >= 2
    ) {
        const [lon, lat] = geom.coordinates;
        if (typeof lat === "number" && typeof lon === "number") {
            coords = { lat, lon };
        }
    }

    if (!coords && approx?.lat != null && approx?.lon != null) {
        coords = { lat: approx.lat, lon: approx.lon };
    }

    // ----------------------------------------
    // Label / título
    // ----------------------------------------
    const label: string | null =
        props["name:pt"] ??
        props.namePt ??
        props.name ??
        approx?.name ??
        null;

    // ----------------------------------------
    // Imagens
    // ----------------------------------------
    const imagesRaw = props.images ?? [];
    const images: string[] = Array.isArray(imagesRaw)
        ? uniq(imagesRaw.filter(Boolean))
        : [];

    const image: string | null =
        props.image ??
        (images.length > 0 ? images[0] : null);

    // ----------------------------------------
    // Contacts (se vierem no GeoJSON)
    // ----------------------------------------
    const phone: string | null = props.phone ?? null;
    const email: string | null = props.email ?? null;
    const website: string | null = props.website ?? null;

    const contacts: Contacts | null =
        phone || email || website
            ? { phone, email, website }
            : null;

    // ----------------------------------------
    // Montar PoiInfo
    // ----------------------------------------
    const poi: Partial<PoiInfo> = {
        label,
        description: props.description ?? null,
        image,
        images,
        coords,
        wikipediaUrl: props.wikipediaUrl ?? null,
        wikidataId: props.wikidataId ?? null,
        website,
        contacts,
        historyText: props.historyText ?? null,
        architectureText: props.architectureText ?? null,
        architects: props.architects ?? undefined,
        architectureStyles: props.architectureStyles ?? undefined,
        materials: props.materials ?? undefined,
        builders: props.builders ?? undefined,
        builtPeriod: props.builtPeriod ?? undefined,
        openingHours: props.openingHours ?? null,
        ratings: props.ratings ?? undefined,
    };

    if (!hasAnyUsefulField(poi)) {
        return null;
    }

    return poi as PoiInfo;
}