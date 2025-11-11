// src/lib/gplaces.ts
// Carregamento Google Maps JS + Places (API nova com fallbacks) e utilitários.

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
        // Não precisamos passar ?libraries=...; vamos usar importLibrary() abaixo.

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
export async function loadPlacesLib(): Promise<google.maps.PlacesLibrary> {
    const g = await loadGoogleMaps();
    // @ts-ignore - importLibrary não está completo em alguns tipos
    return (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
}

/** Garante a lib geometry disponível (para computeDistanceBetween) */
async function ensureGeometryLib(): Promise<void> {
    const g = await loadGoogleMaps();
    try {
        // @ts-ignore
        await g.maps.importLibrary?.("geometry");
    } catch {
        // sem geometry, tratamos com fallback mais abaixo
    }
}

/** Nearby viewpoints (opcional, mantido para quem usa) */
export async function nearbyViewpointsByCoords(
    lat: number,
    lng: number,
    radius = 3000
): Promise<any[]> {
    const g = await loadGoogleMaps();
    const placesLib = await loadPlacesLib();
    const keyword = "miradouro OR viewpoint OR mirador OR belvedere OR overlook OR mirante";

    // Tenta API nova
    try {
        // @ts-ignore
        const { Place } = placesLib as any;
        if (Place && typeof Place.searchNearby === "function") {
            const req: any = {
                locationRestriction: { center: { lat, lng }, radius },
                textQuery: keyword,
                language: "pt",
            };
            // @ts-ignore
            const resp = await Place.searchNearby(req);
            const arr = resp?.places ?? [];
            if (arr.length) return arr;
        }
    } catch (err) {
        console.warn("ℹ️ Place.searchNearby não disponível, a usar legacy nearbySearch.", err);
    }

    // Fallback (legacy)
    const div = document.createElement("div");
    div.style.width = "0";
    div.style.height = "0";
    document.body.appendChild(div);
    const map = new g.maps.Map(div, { center: { lat, lng }, zoom: 14 });
    // @ts-ignore
    const service = new g.maps.places.PlacesService(map);

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

/** Details por place_id (API nova -> fallback legacy) */
export async function getPlaceDetailsById(placeId: string): Promise<any> {
    const g = await loadGoogleMaps();
    const placesLib = await loadPlacesLib();

    // Nova
    try {
        // @ts-ignore
        const { Place } = placesLib as any;
        if (Place) {
            // @ts-ignore
            const place = new Place({ id: placeId });
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
                "opening_hours", // algumas builds ainda populam isto
            ];
            // @ts-ignore
            await place.fetchFields({ fields, language: "pt" });
            return place;
        }
    } catch (err) {
        console.warn("ℹ️ Place.fetchFields não disponível, a usar getDetails (legacy).", err);
    }

    // Legacy
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

    // API nova
    if (typeof phs[0]?.getURI === "function") {
        return phs.slice(0, 8).map((p: any) => p.getURI({ maxWidth: max }));
    }
    // Legacy
    if (typeof phs[0]?.getUrl === "function") {
        return phs.slice(0, 8).map((p: any) => p.getUrl({ maxWidth: max }));
    }
    return [];
}

/** Procura por nome enviesado pelas coords, devolve id + ponto corrigido */
export async function findPlaceByNameAndPoint(
    name: string,
    lat: number,
    lng: number,
    radius = 250
): Promise<{ place_id: string; name: string; lat: number; lng: number } | null> {
    const g = await loadGoogleMaps();
    const placesLib = await loadPlacesLib();
    await ensureGeometryLib();

    // API nova
    try {
        // @ts-ignore
        const { Place } = placesLib as any;
        if (Place && typeof Place.searchNearby === "function") {
            const req: any = {
                locationRestriction: { center: { lat, lng }, radius },
                textQuery: name,
                language: "pt",
            };
            // @ts-ignore
            const resp = await Place.searchNearby(req);
            const arr: any[] = resp?.places ?? [];
            if (arr.length) {
                const dist = (a: { lat: number; lng: number }) => {
                    try {
                        // @ts-ignore
                        const d = g.maps.geometry?.spherical?.computeDistanceBetween?.(
                            new g.maps.LatLng(lat, lng),
                            new g.maps.LatLng(a.lat, a.lng)
                        );
                        return typeof d === "number" ? d : Number.POSITIVE_INFINITY;
                    } catch {
                        // fallback: distância euclidiana aproximada (graus)
                        const dx = (a.lng - lng) * Math.cos(((lat + a.lat) / 2) * (Math.PI / 180));
                        const dy = a.lat - lat;
                        return Math.sqrt(dx * dx + dy * dy);
                    }
                };

                const best = arr
                    .map((p) => {
                        const n = p.displayName?.text || p.name || "";
                        const loc =
                            p.location && typeof p.location.lat === "function"
                                ? { lat: p.location.lat(), lng: p.location.lng() }
                                : p.location || null;
                        const ov = (name || "")
                            .toLowerCase()
                            .split(/\s+/)
                            .filter(Boolean)
                            .reduce((k, t) => k + (n.toLowerCase().includes(t) ? 1 : 0), 0);
                        const d = loc ? dist(loc) : Number.POSITIVE_INFINITY;
                        return { p, n, loc, ov, d };
                    })
                    .sort((a, b) => (a.d - b.d) || (b.ov - a.ov))[0];

                if (best?.p?.id && best.loc) {
                    return { place_id: best.p.id, name: best.n, lat: best.loc.lat, lng: best.loc.lng };
                }
            }
        }
    } catch (e) {
        console.warn("findPlaceByNameAndPoint (novo) falhou, vou ao fallback.", e);
    }

    // Fallback: Text Search (legacy)
    const div = document.createElement("div");
    div.style.cssText = "width:0;height:0";
    document.body.appendChild(div);
    const map = new g.maps.Map(div, { center: { lat, lng }, zoom: 15 });
    // @ts-ignore
    const svc = new g.maps.places.PlacesService(map);

    const res = await new Promise<any[]>((resolve) => {
        // @ts-ignore
        svc.textSearch(
            { query: name, location: { lat, lng }, radius, language: "pt" } as any,
            // @ts-ignore
            (items, status) => {
                // @ts-ignore
                if (status === g.maps.places.PlacesServiceStatus.OK && items) resolve(items);
                else resolve([]);
            }
        );
    });

    if (!res.length) return null;

    const distLegacy = (a: { lat: number; lng: number }) => {
        try {
            // @ts-ignore
            const d = g.maps.geometry?.spherical?.computeDistanceBetween?.(
                new g.maps.LatLng(lat, lng),
                new g.maps.LatLng(a.lat, a.lng)
            );
            return typeof d === "number" ? d : Number.POSITIVE_INFINITY;
        } catch {
            const dx = (a.lng - lng) * Math.cos(((lat + a.lat) / 2) * (Math.PI / 180));
            const dy = a.lat - lat;
            return Math.sqrt(dx * dx + dy * dy);
        }
    };

    const best = res
        .map((r) => {
            const n = r.name || "";
            const loc = r.geometry?.location
                ? { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }
                : null;
            const ov = (name || "")
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean)
                .reduce((k, t) => k + (n.toLowerCase().includes(t) ? 1 : 0), 0);
            const d = loc ? distLegacy(loc) : Number.POSITIVE_INFINITY;
            return { r, n, loc, ov, d };
        })
        .sort((a, b) => (a.d - b.d) || (b.ov - a.ov))[0];

    if (best?.r?.place_id && best.loc) {
        return { place_id: best.r.place_id, name: best.n, lat: best.loc.lat, lng: best.loc.lng };
    }
    return null;
}

/* ------------------------------------------------------------------
   Aliases úteis para compatibilidade com imports antigos
------------------------------------------------------------------- */
export { loadGoogleMaps as loadGoogleMap }; // evita TS2305 se alguém importar o nome no singular