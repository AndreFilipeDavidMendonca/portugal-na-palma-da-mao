// src/lib/gplaces.ts
// Carregamento manual do Google Maps JS API + Places (moderno)
// Tenta usar a API nova (Place.searchNearby / Place.fetchFields)
// com fallback para PlacesService (nearbySearch/getDetails).

declare global {
    interface Window {
        google?: typeof google;
    }
}

let gmapsReady: Promise<typeof google> | null = null;

function ensureKey(): string {
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!key) throw new Error("VITE_GOOGLE_MAPS_API_KEY não definida.");
    // Chaves que começam por GOCSPX são de Service Account – não servem no browser.
    if (/^GOCSPX-|^\{/.test(key)) {
        console.warn("⚠️ Esta chave parece de serviço. Cria uma Browser key (HTTP referrer).");
    }
    return key;
}

export async function loadGoogleMaps(): Promise<typeof google> {
    if (gmapsReady) return gmapsReady;

    gmapsReady = new Promise<typeof google>((resolve, reject) => {
        const key = ensureKey();

        // Já está carregado?
        if (typeof window !== "undefined" && window.google?.maps) {
            resolve(window.google);
            return;
        }

        const url = new URL("https://maps.googleapis.com/maps/api/js");
        url.searchParams.set("key", key);
        url.searchParams.set("v", "weekly");
        url.searchParams.set("language", "pt");

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

/** Carrega a lib 'places' (API moderna via importLibrary) */
async function loadPlacesLib(): Promise<google.maps.PlacesLibrary> {
    const g = await loadGoogleMaps();
    // Algumas defs de types ainda não expõem importLibrary corretamente, por isso o cast.
    // @ts-ignore
    return (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
}

/** Nearby: usa Place.searchNearby (novo). Se falhar, faz fallback para PlacesService.nearbySearch */
export async function nearbyViewpointsByCoords(
    lat: number,
    lng: number,
    radius = 3000
): Promise<any[]> {
    const g = await loadGoogleMaps();
    const placesLib = await loadPlacesLib();
    const keyword = "miradouro OR viewpoint OR mirador OR belvedere OR overlook OR mirante";

    // 1) Tentativa com API nova
    try {
        // @ts-ignore – tipos do runtime podem divergir das d.ts publicadas
        const { Place } = placesLib as any;

        if (Place && typeof Place.searchNearby === "function") {
            // A API nova usa locationRestriction (centro+raio) e aceita textQuery/includedTypes.
            const req: any = {
                locationRestriction: {
                    center: { lat, lng },
                    radius,
                },
                textQuery: keyword,
                language: "pt",
            };

            // @ts-ignore
            const resp = await Place.searchNearby(req);
            const arr = resp?.places ?? [];
            console.log("📍 Places (novo) nearby:", {
                total: arr.length,
                sample: arr.slice(0, 3).map((p: any) => p.displayName?.text || p.name),
            });
            if (arr.length) return arr;
        }
    } catch (err) {
        console.warn("ℹ️ Place.searchNearby não disponível, vou usar PlacesService.nearbySearch.", err);
    }

    // 2) Fallback para API antiga
    // Cria um map “headless” apenas para o service
    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);

    const map = new g.maps.Map(div, { center: { lat, lng }, zoom: 14 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    console.log("🛰️ Places nearby (legacy)", { lat, lng, radius, keyword });

    const legacyResults = await new Promise<google.maps.places.PlaceResult[]>((resolve, reject) => {
        // @ts-ignore
        service.nearbySearch(
            { location: { lat, lng }, radius, keyword, language: "pt" } as any,
            // @ts-ignore
            (res, status) => {
                // @ts-ignore
                if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
                else reject(new Error(`nearbySearch falhou: ${status}`));
            }
        );
    });

    return legacyResults as any[];
}

/** Details: usa Place.fetchFields (novo). Se falhar, fallback para PlacesService.getDetails */
export async function getPlaceDetailsById(placeId: string): Promise<any> {
    const g = await loadGoogleMaps();
    const placesLib = await loadPlacesLib();

    // 1) Tenta API nova
    try {
        // @ts-ignore
        const { Place } = placesLib as any;
        if (Place) {
            // @ts-ignore
            const place = new Place({ id: placeId });
            // Campos do novo modelo (equivalentes aos antigos)
            const fields = [
                "id",
                "displayName",
                "location",
                "formattedAddress",
                "websiteUri",
                "rating",
                "userRatingCount",
                "photos",
                "googleMapsUri",
            ];

            // @ts-ignore
            await place.fetchFields({ fields, language: "pt" });

            return place;
        }
    } catch (err) {
        console.warn("ℹ️ Place.fetchFields não disponível, vou usar PlacesService.getDetails.", err);
    }

    // 2) Fallback para API antiga
    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);
    const map = new g.maps.Map(div, { center: { lat: 0, lng: 0 }, zoom: 3 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

    const fieldsLegacy: Array<keyof google.maps.places.PlaceResult> = [
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

    const res = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
        // @ts-ignore
        service.getDetails({ placeId, fields: fieldsLegacy } as any, (det, status) => {
            // @ts-ignore
            if (status === g.maps.places.PlacesServiceStatus.OK && det) resolve(det);
            else reject(new Error(`getDetails falhou: ${status}`));
        });
    });

    return res as any;
}

/** URLs de fotos (suporta modelo novo e antigo) */
export function photoUrlsFromPlace(place: any, max = 1600): string[] {
    const phs = place?.photos ?? [];
    if (!Array.isArray(phs) || phs.length === 0) return [];

    // API nova: photo.getURI({maxWidth})
    if (typeof phs[0]?.getURI === "function") {
        return phs.slice(0, 8).map((p: any) => p.getURI({ maxWidth: max }));
    }
    // API antiga: photo.getUrl({maxWidth})
    if (typeof phs[0]?.getUrl === "function") {
        return phs.slice(0, 8).map((p: any) => p.getUrl({ maxWidth: max }));
    }
    return [];
}