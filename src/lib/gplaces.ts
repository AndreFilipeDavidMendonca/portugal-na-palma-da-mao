// src/lib/gplaces.ts
// -------------------------------------------------------------
// Carregamento do Google Maps JS + Places (legacy) e utilitários
// com lógica especial para miradouros:
//  - usa sempre coords (lat/lng) como âncora;
//  - limpa artigos/pronomes (do/da/de/das/dos/o/a/os/as);
//  - para nomes "Miradouro ...":
//      1) tenta match exato (nome completo);
//      2) se falhar, dentro do mesmo array tenta "Jardim ...", "Largo ...",
//         "Parque ..." + baseName;
//      3) se ainda falhar, escolhe o melhor candidato por texto+distância
//         filtrando tipos "maus" (cafés, bilheteiras, etc);
//      4) fallback final: o mais próximo das coords.
// -------------------------------------------------------------

declare global {
    interface Window {
        google?: typeof google;
    }
}

let gmapsReady: Promise<typeof google> | null = null;

function ensureKey(): string {
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error("VITE_GOOGLE_MAPS_API_KEY não definida.");
    if (/^GOCSPX-|^\{/.test(key)) {
        console.warn("⚠️ Esta chave parece de serviço. Cria uma Browser key (HTTP referrer).");
    }
    return key;
}

/**
 * Carrega o script do Google Maps JS com as libs necessárias
 * (`places` e `geometry`) e devolve o objeto `google`.
 */
export async function loadGoogleMaps(): Promise<typeof google> {
    if (gmapsReady) return gmapsReady;

    gmapsReady = new Promise<typeof google>((resolve, reject) => {
        const key = ensureKey();

        if (typeof window !== "undefined" && window.google?.maps) {
            resolve(window.google);
            return;
        }

        const url = new URL("https://maps.googleapis.com/maps/api/js");
        url.searchParams.set("key", key);
        url.searchParams.set("v", "weekly");
        url.searchParams.set("language", "pt");
        url.searchParams.set("libraries", "places,geometry");

        const s = document.createElement("script");
        s.src = url.toString();
        s.async = true;
        s.defer = true;
        s.onerror = () => reject(new Error("Falha a carregar Google Maps JS API"));
        s.onload = () => {
            if (window.google?.maps) resolve(window.google);
            else reject(new Error("Google Maps não inicializou."));
        };

        document.head.appendChild(s);
    });

    return gmapsReady;
}

/* =====================================================================
   VIEWPOINTS PRÓXIMOS (legacy nearbySearch - opcional)
   ===================================================================== */

export async function nearbyViewpointsByCoords(
    lat: number,
    lng: number,
    radius = 3000
): Promise<google.maps.places.PlaceResult[]> {
    const g = await loadGoogleMaps();

    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);

    const map = new g.maps.Map(div, { center: { lat, lng }, zoom: 14 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    const keyword = "miradouro OR viewpoint OR mirador OR belvedere OR overlook OR mirante";

    const results = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
        // @ts-ignore
        service.nearbySearch(
            {
                location: { lat, lng },
                radius,
                keyword,
                language: "pt",
            } as any,
            // @ts-ignore
            (res, status) => {
                // @ts-ignore
                if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
                else reject(new Error(`nearbySearch falhou: ${status}`));
            }
        );
    });

    return results;
}

/* =====================================================================
   DETAILS POR place_id (legacy getDetails)
   ===================================================================== */

export async function getPlaceDetailsById(placeId: string): Promise<any> {
    const g = await loadGoogleMaps();

    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);

    const map = new g.maps.Map(div, { center: { lat: 0, lng: 0 }, zoom: 3 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    const fields: Array<keyof google.maps.places.PlaceResult> = [
        "name",
        "geometry",
        "url",
        "website",
        "formatted_address",
        "opening_hours",
        "rating",
        "user_ratings_total",
        "photos",
    ];

    const result = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
        // @ts-ignore
        service.getDetails(
            { placeId, fields, language: "pt" } as any,
            (det, status) => {
                // @ts-ignore
                if (status === g.maps.places.PlacesServiceStatus.OK && det) resolve(det);
                else reject(new Error(`getDetails falhou: ${status}`));
            }
        );
    });

    return result as any;
}

/* =====================================================================
   FOTOS DO PLACE
   ===================================================================== */

export function photoUrlsFromPlace(place: any, max = 1600): string[] {
    const phs = place?.photos ?? [];
    if (!Array.isArray(phs) || phs.length === 0) return [];

    if (typeof phs[0]?.getURI === "function") {
        return phs.slice(0, 8).map((p: any) => p.getURI({ maxWidth: max }));
    }
    if (typeof phs[0]?.getUrl === "function") {
        return phs.slice(0, 8).map((p: any) => p.getUrl({ maxWidth: max }));
    }
    return [];
}

/* =====================================================================
   HELPERS: normalização, distância, tipos "maus" para miradouros
   ===================================================================== */

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
    "real_estate_agency",
]);

function normalizeText(value?: string | null): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function normalizeForMatch(value?: string | null): string {
    let base = normalizeText(value);

    // remover artigos/preposições em qualquer posição
    base = base.replace(/\b(do|da|de|dos|das|d|o|a|os|as)\b/g, " ");

    return base.replace(/\s+/g, " ").trim();
}

function filterByRadius(
    g: typeof google,
    results: google.maps.places.PlaceResult[],
    lat: number,
    lng: number,
    maxDistMeters: number
): google.maps.places.PlaceResult[] {
    return results.filter((r) => {
        const loc = r.geometry?.location
            ? {
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
            }
            : null;

        if (!loc) return false;

        const d = distanceMeters(g, lat, lng, loc.lat, loc.lng);
        // @ts-ignore – guardamos para debug / scoring posterior se quisermos
        (r as any)._dist = d;

        return d <= maxDistMeters;
    });
}

function distanceMeters(
    g: typeof google,
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    try {
        // @ts-ignore
        const d = g.maps.geometry?.spherical?.computeDistanceBetween?.(
            new g.maps.LatLng(lat1, lng1),
            new g.maps.LatLng(lat2, lng2)
        );
        if (typeof d === "number") return d;
    } catch {
        // ignore
    }

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371_000; // m
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Deteta se o nome é de um miradouro e extrai o "base name" sem o prefixo.
 * Ex: "Miradouro do Castelo de São Jorge" → {isViewpoint:true, baseName:"Castelo de São Jorge"}
 */
function parseViewpointName(rawName: string): { isViewpoint: boolean; baseName: string } {
    const original = rawName.trim();

    const reFull = /^miradouro\s+(do|da|de|dos|das)\s+/i;
    const reSimple = /^miradouro\s+/i;

    if (!reFull.test(original) && !reSimple.test(original)) {
        return { isViewpoint: false, baseName: original };
    }

    const cleaned = original.replace(reFull, "").replace(reSimple, "").trim();

    return {
        isViewpoint: true,
        baseName: cleaned || original,
    };
}

/* =====================================================================
   textSearch (legacy)
   ===================================================================== */

async function textSearchPlaces(
    g: typeof google,
    query: string,
    lat: number,
    lng: number,
    radius: number
): Promise<google.maps.places.PlaceResult[]> {
    const div = document.createElement("div");
    div.style.cssText = "width:0;height:0";
    document.body.appendChild(div);

    const map = new g.maps.Map(div, { center: { lat, lng }, zoom: 15 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    return await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
        // @ts-ignore
        service.textSearch(
            {
                query,
                location: { lat, lng },
                radius,
                language: "pt",
            } as any,
            // @ts-ignore
            (items, status) => {
                // @ts-ignore
                if (status === g.maps.places.PlacesServiceStatus.OK && items) resolve(items);
                else resolve([]);
            }
        );
    });
}

async function textSearchWithPrefixes(
    g: typeof google,
    baseName: string,
    lat: number,
    lng: number,
    radius: number,
    prefixes: string[]
): Promise<google.maps.places.PlaceResult[]> {
    const all: google.maps.places.PlaceResult[] = [];

    for (const pfx of prefixes) {
        const query = `${pfx} ${baseName}`;

        const res = await textSearchPlaces(g, query, lat, lng, radius);
        all.push(...res);
    }

    return all;
}

/* =====================================================================
   ENRICH: aplicar normalização ao array de resultados
   ===================================================================== */

function enrichResultsForMatch(
    results: google.maps.places.PlaceResult[]
): google.maps.places.PlaceResult[] {
    return results.map((r) => {
        (r as any)._normName = normalizeForMatch(r.name || "");
        return r;
    });
}

/* =====================================================================
   PICKERS DE CANDIDATOS
   ===================================================================== */

function pickExactMatches(
    results: google.maps.places.PlaceResult[],
    targetNames: string[]
): google.maps.places.PlaceResult[] {
    const normTargets = targetNames.map((n) => normalizeForMatch(n)).filter(Boolean);
    if (!normTargets.length) return [];

    const matches = results.filter((r) => {
        // @ts-ignore
        const rn = r._normName || normalizeForMatch(r.name || "");
        return normTargets.includes(rn);
    });

    return matches;
}

/**
 * Para miradouros: se não há exactMatch, preferimos:
 *  - primeiro "Jardim ... baseName"
 *  - depois "Largo ... baseName"
 *  - depois "Parque ... baseName"
 *  Tudo isto dentro *dos mesmos resultados*.
 */
function pickPreferredPrefixCandidate(
    g: typeof google,
    results: google.maps.places.PlaceResult[],
    baseName: string,
    lat: number,
    lng: number
): google.maps.places.PlaceResult | null {
    const baseNorm = normalizeForMatch(baseName);
    const baseTokens = baseNorm.split(" ").filter(Boolean);

    const tryPrefix = (prefix: string) => {
        const candidates = results.filter((r) => {
            // @ts-ignore
            const rn = (r._normName as string) || normalizeForMatch(r.name || "");
            if (!rn.startsWith(prefix + " ")) return false;
            const hasToken = baseTokens.some((t) => rn.includes(t));
            return hasToken;
        });

        if (!candidates.length) return null;

        const scored = candidates.map((r) => {
            const loc = r.geometry?.location
                ? {
                    lat: r.geometry.location.lat(),
                    lng: r.geometry.location.lng(),
                }
                : null;
            const d = loc ? distanceMeters(g, lat, lng, loc.lat, loc.lng) : Number.POSITIVE_INFINITY;
            return { r, d };
        });

        scored.sort((a, b) => a.d - b.d);
        return scored[0].r;
    };

    const prefixes = ["jardim", "largo", "parque"];

    for (const p of prefixes) {
        const picked = tryPrefix(p);
        if (picked) {
            return picked;
        }
    }

    return null;
}

/**
 * Para miradouros: filtra tipos "maus" (lojas, cafés, bilheteiras, etc)
 * e escolhe o mais próximo + com melhor overlap textual.
 */
function pickBestViewpointGeneric(
    g: typeof google,
    results: google.maps.places.PlaceResult[],
    baseName: string,
    lat: number,
    lng: number
): google.maps.places.PlaceResult | null {
    if (!results.length) return null;

    const baseTokens = normalizeForMatch(baseName).split(" ").filter(Boolean);

    const filtered = results.filter((r) => {
        const types: string[] = (r.types || []) as string[];
        if (!types.length) return true;
        return !types.some((t) => BAD_VIEWPOINT_TYPES.has(t));
    });

    const pool = filtered.length ? filtered : results;

    const scored = pool.map((r) => {
        // @ts-ignore
        const rnNorm = (r._normName as string) || normalizeForMatch(r.name || "");
        const overlap = baseTokens.reduce(
            (acc, t) => acc + (rnNorm.includes(t) ? 1 : 0),
            0
        );

        const loc = r.geometry?.location
            ? {
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
            }
            : null;

        const d = loc ? distanceMeters(g, lat, lng, loc.lat, loc.lng) : Number.POSITIVE_INFINITY;

        const score = overlap * 10 - d / 50;

        return { r, overlap, d, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return best ? best.r : null;
}

/**
 * Genérico (não viewpoint): melhor score texto + distância, sem filtro de tipos.
 */
function pickBestGeneric(
    g: typeof google,
    results: google.maps.places.PlaceResult[],
    baseName: string,
    lat: number,
    lng: number
): google.maps.places.PlaceResult | null {
    if (!results.length) return null;

    const baseTokens = normalizeForMatch(baseName).split(" ").filter(Boolean);

    const scored = results.map((r) => {
        // @ts-ignore
        const rnNorm = (r._normName as string) || normalizeForMatch(r.name || "");
        const overlap = baseTokens.reduce(
            (acc, t) => acc + (rnNorm.includes(t) ? 1 : 0),
            0
        );

        const loc = r.geometry?.location
            ? {
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
            }
            : null;

        const d = loc ? distanceMeters(g, lat, lng, loc.lat, loc.lng) : Number.POSITIVE_INFINITY;
        const score = overlap * 10 - d / 50;

        return { r, overlap, d, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return best ? best.r : null;
}

/**
 * Último fallback: escolhe simplesmente o mais perto das coords.
 */
function pickClosestByDistance(
    g: typeof google,
    results: google.maps.places.PlaceResult[],
    lat: number,
    lng: number
): google.maps.places.PlaceResult | null {
    if (!results.length) return null;

    const scored = results.map((r) => {
        const loc = r.geometry?.location
            ? {
                lat: r.geometry.location.lat(),
                lng: r.geometry.location.lng(),
            }
            : null;

        const d = loc ? distanceMeters(g, lat, lng, loc.lat, loc.lng) : Number.POSITIVE_INFINITY;
        return { r, d };
    });

    scored.sort((a, b) => a.d - b.d);
    const best = scored[0];

    return best ? best.r : null;
}

/* =====================================================================
   FIND BY NAME + COORDS (com lógica especial para miradouros)
   ===================================================================== */

export async function findPlaceByNameAndPoint(
    name: string,
    lat: number,
    lng: number,
    radius = 3000 // raio de pesquisa base
): Promise<{ place_id: string; name: string; lat: number; lng: number } | null> {
    const g = await loadGoogleMaps();

    const trimmedName = name.trim();
    const { isViewpoint, baseName } = parseViewpointName(trimmedName);

    const ACCEPT_RADIUS = 3000; // 3 km – filtro duro que pediste

    // 1) Fazemos textSearch com o nome original (para ter um pool inicial)
    let results = await textSearchPlaces(g, trimmedName, lat, lng, radius);

    // fallback: se não vier nada e o baseName for diferente, tentamos com baseName
    if (!results.length && baseName !== trimmedName) {
        results = await textSearchPlaces(g, baseName, lat, lng, radius);
    }

    // normalizar + filtrar por 3 km
    results = enrichResultsForMatch(results);
    results = filterByRadius(g, results, lat, lng, ACCEPT_RADIUS);

    if (!results.length) return null;

    // ------------- RAMO MIRADOURO (quando o nome já vem com Miradouro ...) -------------
    if (isViewpoint) {
        // 1) exact match do nome completo do miradouro (depois de limpeza)
        const exactMatches = pickExactMatches(results, [trimmedName]);

        if (exactMatches.length) {
            const picked = pickClosestByDistance(g, exactMatches, lat, lng);
            if (picked && picked.place_id && picked.geometry?.location) {
                const loc = picked.geometry.location;
                return {
                    place_id: picked.place_id,
                    name: picked.name || baseName,
                    lat: loc.lat(),
                    lng: loc.lng(),
                };
            }
        }

        // 2) Jardim / Largo / Parque dentro do mesmo pool
        const prefixCandidate = pickPreferredPrefixCandidate(g, results, baseName, lat, lng);
        if (prefixCandidate && prefixCandidate.place_id && prefixCandidate.geometry?.location) {
            const loc = prefixCandidate.geometry.location;
            return {
                place_id: prefixCandidate.place_id,
                name: prefixCandidate.name || baseName,
                lat: loc.lat(),
                lng: loc.lng(),
            };
        }

        // 3) fallback genérico (miradouro-ish) filtrando tipos maus
        const bestViewpoint = pickBestViewpointGeneric(g, results, baseName, lat, lng);
        if (bestViewpoint && bestViewpoint.place_id && bestViewpoint.geometry?.location) {
            const loc = bestViewpoint.geometry.location;
            return {
                place_id: bestViewpoint.place_id,
                name: bestViewpoint.name || baseName,
                lat: loc.lat(),
                lng: loc.lng(),
            };
        }

        // 4) último recurso dentro dos 3 km
        const closest = pickClosestByDistance(g, results, lat, lng);
        if (closest && closest.place_id && closest.geometry?.location) {
            const loc = closest.geometry.location;
            return {
                place_id: closest.place_id,
                name: closest.name || baseName,
                lat: loc.lat(),
                lng: loc.lng(),
            };
        }

        return null;
    }

    // ---------------- GENÉRICO (NÃO começa por "Miradouro ...") ----------------
    // Ordem que definimos:
    // 1) Miradouro + baseName
    // 2) Jardim / Largo / Parque + baseName
    // 3) Só depois tentar match pelo baseName dentro de 3 km

    // 1) Miradouro <baseName>
    let prefixResults: google.maps.places.PlaceResult[] = [];

    {
        const miradouroRes = await textSearchPlaces(
            g,
            `Miradouro ${baseName}`,
            lat,
            lng,
            radius
        );
        let filtered = enrichResultsForMatch(miradouroRes);
        filtered = filterByRadius(g, filtered, lat, lng, ACCEPT_RADIUS);

        if (filtered.length) {
            prefixResults.push(...filtered);
        }
    }

    // 2) Jardim / Largo / Parque <baseName>, só se ainda não encontrámos nada
    if (!prefixResults.length) {
        const extra = await textSearchWithPrefixes(
            g,
            baseName,
            lat,
            lng,
            radius,
            ["Jardim", "Largo", "Parque"]
        );
        let filtered = enrichResultsForMatch(extra);
        filtered = filterByRadius(g, filtered, lat, lng, ACCEPT_RADIUS);

        if (filtered.length) {
            prefixResults.push(...filtered);
        }
    }

    // Se encontrámos algo com Miradouro/Jardim/Largo/Parque, usamos lógica "viewpoint"
    if (prefixResults.length) {
        const bestView = pickBestViewpointGeneric(g, prefixResults, baseName, lat, lng);
        if (bestView && bestView.place_id && bestView.geometry?.location) {
            const loc = bestView.geometry.location;
            return {
                place_id: bestView.place_id,
                name: bestView.name || baseName,
                lat: loc.lat(),
                lng: loc.lng(),
            };
        }
    }

    // 3) Só agora fazemos match pelo baseName, mas SEM sair dos 3 km
    const exactGeneric = pickExactMatches(results, [trimmedName, baseName]);

    if (exactGeneric.length) {
        const picked = pickClosestByDistance(g, exactGeneric, lat, lng);
        if (picked && picked.place_id && picked.geometry?.location) {
            const loc = picked.geometry.location;
            return {
                place_id: picked.place_id,
                name: picked.name || baseName,
                lat: loc.lat(),
                lng: loc.lng(),
            };
        }
    }

    // 4) Fallback genérico melhor score (overlap texto + distância) mas SEM sair dos 3km
    const bestGeneric = pickBestGeneric(g, results, baseName || trimmedName, lat, lng);
    if (bestGeneric && bestGeneric.place_id && bestGeneric.geometry?.location) {
        const loc = bestGeneric.geometry.location;
        return {
            place_id: bestGeneric.place_id,
            name: bestGeneric.name || baseName || trimmedName,
            lat: loc.lat(),
            lng: loc.lng(),
        };
    }

    // 5) Último recurso – ainda dentro dos 3 km, porque já filtrámos results lá em cima
    const closest = pickClosestByDistance(g, results, lat, lng);
    if (closest && closest.place_id && closest.geometry?.location) {
        const loc = closest.geometry.location;
        return {
            place_id: closest.place_id,
            name: closest.name || baseName || trimmedName,
            lat: loc.lat(),
            lng: loc.lng(),
        };
    }

    return null;
}

/* ------------------------------------------------------------------
   Alias útil para compatibilidade com imports antigos
------------------------------------------------------------------- */
export { loadGoogleMaps as loadGoogleMap };