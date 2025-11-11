// src/features/topbar/TopDistrictFilter.tsx
import {useEffect, useMemo, useRef, useState} from "react";
import logo from "@/assets/logo.png";
import "./TopDistrictFilter.scss";

import {loadGeo} from "@/lib/geo";
import {buildCulturalPointsQuery, overpassQueryToGeoJSON} from "@/lib/overpass";
import PoiModal from "@/pages/poi/PoiModal";
import {fetchPoiInfo, type PoiInfo} from "@/lib/poiInfo";
import SpinnerOverlay from "@/components/SpinnerOverlay";

type Props = {
    allNames: string[];
    onPick: (name: string) => void;
    placeholder?: string;
};

/* ---------------- helpers ---------------- */
function norm(s?: string | null) {
    return (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
function featureName(f: any): string | null {
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
function isUsefulPoiFeature(props: any): boolean {
    const tags = props.tags ?? {};
    const hasRefs =
        props.wikipedia ||
        props["wikipedia:pt"] ||
        props["wikipedia:en"] ||
        props.wikidata ||
        props["wikidata:id"] ||
        props.website ||
        props["contact:website"] ||
        props.image ||
        props["wikimedia_commons"] ||
        tags.wikipedia ||
        tags.wikidata ||
        tags.website ||
        tags.image;

    const hasType =
        props.historic ||
        props.building ||
        props.castle_type ||
        props.amenity ||
        props.tourism ||
        props.leisure ||
        props.boundary;

    return Boolean(hasRefs || hasType);
}

/* === NOVO: fuzzy match por tokens e subsequência === */
const STOPWORDS = new Set([
    "o","a","os","as","um","uma","uns","umas",
    "de","do","da","dos","das","d","e",
    "no","na","nos","nas",
    "ao","aos","à","às",
    "para","por","em",
    "the","of","and",
    "nacional" // palavra intermédia comum que não deve “estragar” o match
]);

function tokenize(s: string): string[] {
    return norm(s).split(" ").filter(t => t && !STOPWORDS.has(t));
}

function isSubsequenceChars(query: string, target: string): boolean {
    // remove espaços e compara como subsequência de letras
    const q = norm(query).replace(/\s+/g, "");
    const t = norm(target).replace(/\s+/g, "");
    let i = 0;
    for (let j = 0; j < t.length && i < q.length; j++) {
        if (t[j] === q[i]) i++;
    }
    return i === q.length;
}

/** devolve uma pontuação; 0 = não relevante */
function scoreNameFlexible(name: string, query: string): number {
    const n = norm(name);
    const q = norm(query);
    if (!q) return 0;

    const nameTokens = tokenize(name);
    const queryTokens = tokenize(query);

    if (!nameTokens.length || !queryTokens.length) return 0;

    // 1) Cobertura de tokens: requer que TODOS os tokens do query apareçam no nome (em qualquer ordem)
    let hits = 0, prefixHits = 0;
    for (const tq of queryTokens) {
        const hit = nameTokens.find(nt => nt.includes(tq));
        if (hit) {
            hits++;
            if (hit.startsWith(tq)) prefixHits++;
        }
    }
    if (hits < queryTokens.length) {
        // 1b) fallback: se falhou por tokens, aceita subsequência de letras (permite “palaci odap ena” etc.)
        return isSubsequenceChars(q, n) ? 35 : 0;
    }

    // 2) Bónus por começar igual / incluir literal
    let score = 0;
    if (n.startsWith(q)) score += 120;
    if (n.includes(q)) score += 60;

    // 3) Bónus por cobertura de tokens e prefixos
    score += hits * 25 + prefixHits * 10;

    // 4) Bónus pequeno por proximidade da ordem (tokens em ordem)
    let inOrder = 0, idx = 0;
    for (const tq of queryTokens) {
        const pos = nameTokens.findIndex((nt, i) => i >= idx && nt.includes(tq));
        if (pos >= idx && pos !== -1) { inOrder++; idx = pos + 1; }
    }
    score += inOrder * 6;

    // 5) Penalização leve por distância de tamanho (evita nomes muito longos vs query curtinha)
    score -= Math.max(0, nameTokens.length - queryTokens.length) * 2;

    return Math.max(1, score); // garante >0 se passou
}

type SearchItem =
    | { kind: "district"; name: string }
    | { kind: "poi"; name: string; feature: any };

export default function TopDistrictFilter({
                                              allNames,
                                              onPick,
                                              placeholder = "Procurar distrito, local ou ponto de interesse…",
                                          }: Props) {
    const [open, setOpen] = useState(false);

    // digitado vs preview com setas
    const [typedQuery, setTypedQuery] = useState("");
    const [previewQuery, setPreviewQuery] = useState<string | null>(null);
    const inputValue = previewQuery ?? typedQuery;

    const [activeIdx, setActiveIdx] = useState(0);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    // ---------- carregar POIs PT ----------
    const [poiAllPT, setPoiAllPT] = useState<any | null>(null);
    useEffect(() => {
        let aborted = false;
        (async () => {
            try {
                const ptGeo = await loadGeo("/geo/portugal.geojson");
                const poly = geoToOverpassPoly(ptGeo);
                if (!poly) return;
                const q = buildCulturalPointsQuery(poly);
                const gj = await overpassQueryToGeoJSON(q, 2);
                if (!aborted) setPoiAllPT(gj);
            } catch {
                if (!aborted) setPoiAllPT(null);
            }
        })();
        return () => { aborted = true; };
    }, []);

    // ---------- índice (distritos + POIs) ----------
    const searchIndex = useMemo<SearchItem[]>(() => {
        const out: SearchItem[] = [];
        for (const n of allNames) out.push({ kind: "district", name: n });

        if (poiAllPT?.features) {
            for (const f of poiAllPT.features) {
                const name = featureName(f);
                if (!name) continue;
                const props = { ...(f.properties || {}), tags: f.properties?.tags ?? {} };
                if (!isUsefulPoiFeature(props)) continue;
                out.push({ kind: "poi", name, feature: f });
            }
        }
        return out;
    }, [allNames, poiAllPT]);

    // ---------- resultados (USAR NOVO SCORING) ----------
    const filtered = useMemo(() => {
        const qRaw = typedQuery;
        const q = norm(qRaw);
        if (!q) return [] as SearchItem[];

        return searchIndex
            .map((it) => {
                const score = scoreNameFlexible(it.name, qRaw) + (it.kind === "poi" ? 5 : 0);
                return { it, score };
            })
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 30)
            .map((x) => x.it);
    }, [typedQuery, searchIndex]);

    // click fora
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    // scroll acompanha a seleção
    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector(".tdf-item.is-active") as HTMLElement | null;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [activeIdx, open, filtered.length]);

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
        }
        if (!filtered.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => {
                const next = Math.min(i + 1, filtered.length - 1);
                setPreviewQuery(filtered[next]?.name ?? null);
                return next;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => {
                const next = Math.max(i - 1, 0);
                setPreviewQuery(filtered[next]?.name ?? null);
                return next;
            });
        } else if (e.key === "Enter") {
            e.preventDefault();
            const pickItem = filtered[activeIdx] || filtered[0];
            if (pickItem) handlePick(pickItem);
        } else if (e.key === "Escape") {
            setOpen(false);
            setPreviewQuery(null);
        }
    }

    // ---------- abrir PoiModal local quando for POI ----------
    const [poiOpen, setPoiOpen] = useState(false);
    const [poiInfo, setPoiInfo] = useState<PoiInfo | null>(null);
    const [poiFeature, setPoiFeature] = useState<any | null>(null);
    const [loadingPoi, setLoadingPoi] = useState(false);
    const poiReqRef = useRef(0);

    async function openPoiFromFeature(f: any) {
        setPoiFeature(f);
        setPoiInfo(null);
        setPoiOpen(false);
        setLoadingPoi(true);
        const reqId = ++poiReqRef.current;

        try {
            const wp: string | null =
                f.properties.wikipedia ?? f.properties["wikipedia:pt"] ?? f.properties["wikipedia:en"] ?? null;
            const approxName = featureName(f);
            const approxLat = f.geometry?.coordinates?.[1];
            const approxLon = f.geometry?.coordinates?.[0];

            const info = await fetchPoiInfo({
                wikipedia: wp,
                approx: { name: approxName, lat: approxLat, lon: approxLon },
                sourceFeature: f,
            });
            if (reqId !== poiReqRef.current) return;

            if (!info) {
                setPoiInfo(null);
                setPoiOpen(false);
                return;
            }

            setPoiInfo(info);
            setPoiOpen(true);
        } catch {
            setPoiInfo(null);
            setPoiOpen(false);
        } finally {
            if (reqId === poiReqRef.current) setLoadingPoi(false);
        }
    }

    function handlePick(item: SearchItem) {
        setOpen(false);
        setPreviewQuery(null);
        setTypedQuery(item.name);

        if (item.kind === "district") {
            onPick(item.name);
            return;
        }
        if (item.kind === "poi") {
            openPoiFromFeature(item.feature);
        }
    }

    return (
        <>
            <div className="tdf-wrap" ref={wrapRef}>
                <div className="tdf-logo">
                    <img src={logo} alt=".pt" />
                </div>

                <span className="tdf-label">Pesquisar</span>

                <div className="tdf-inputbox">
                    <input
                        className="tdf-input"
                        value={inputValue}
                        placeholder={placeholder}
                        onChange={(e) => {
                            setTypedQuery(e.target.value);
                            setPreviewQuery(null);
                            setOpen(true);
                            setActiveIdx(0);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onKeyDown}
                    />

                    {open && filtered.length > 0 && (
                        <ul className="tdf-list gold-scroll" role="listbox" ref={listRef}>
                            {filtered.map((item, i) => (
                                <li
                                    key={`${item.kind}:${item.name}:${i}`}
                                    role="option"
                                    aria-selected={i === activeIdx}
                                    className={`tdf-item ${i === activeIdx ? "is-active" : ""}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handlePick(item);
                                    }}
                                    onMouseEnter={() => {
                                        setActiveIdx(i);
                                        setPreviewQuery(item.name);
                                    }}
                                >
                                    {item.name}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {inputValue && (
                    <button
                        className="btn-clear"
                        onClick={() => {
                            setTypedQuery("");
                            setPreviewQuery(null);
                            setOpen(false);
                            setActiveIdx(0);
                            onPick("");
                        }}
                    >
                        Limpar
                    </button>
                )}
            </div>

            {/* PoiModal local */}
            <PoiModal
                open={poiOpen}
                info={poiInfo}
                poi={poiFeature}
                onClose={() => {
                    setPoiOpen(false);
                    setPoiInfo(null);
                    setPoiFeature(null);
                }}
            />

            {loadingPoi && (
                <SpinnerOverlay open={loadingPoi} message="A carregar…" />
            )}
        </>
    );
}

/** Converte GeoJSON PT em poly:"lat lon ..." para Overpass */
function geoToOverpassPoly(geo: any): string | null {
    const rings: number[][][] = [];
    const pushFeature = (f: any) => {
        const g = f.geometry || f;
        if (!g) return;
        if (g.type === "Polygon") {
            if (Array.isArray(g.coordinates?.[0])) rings.push(g.coordinates[0]);
        } else if (g.type === "MultiPolygon") {
            for (const poly of g.coordinates || []) {
                if (Array.isArray(poly?.[0])) rings.push(poly[0]);
            }
        }
    };
    if (geo?.type === "FeatureCollection") for (const f of geo.features || []) pushFeature(f);
    else if (geo?.type === "Feature") pushFeature(geo);
    else if (geo) pushFeature(geo);

    if (!rings.length) return null;
    const parts: string[] = [];
    for (const ring of rings) for (const [lng, lat] of ring) parts.push(`${lat} ${lng}`);
    return `poly:"${parts.join(" ")}"`;
}