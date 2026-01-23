// src/features/topbar/TopDistrictFilter.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./TopDistrictFilter.scss";

export type PoiSearchItem = {
    id: number;
    name: string;
    districtId?: number | null;
};

export type SearchItem =
    | { kind: "district"; name: string }
    | { kind: "poi"; id: number; name: string; districtId?: number | null };

type Props = {
    districts: string[];
    pois: PoiSearchItem[];
    onPick: (item: SearchItem) => void;
    placeholder?: string;
    loadingPois?: boolean;
};

/* helpers */
function norm(s?: string | null) {
    return (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

const STOPWORDS = new Set([
    "o","a","os","as","um","uma","uns","umas",
    "de","do","da","dos","das","d","e",
    "no","na","nos","nas",
    "ao","aos","à","às",
    "para","por","em",
    "the","of","and",
    "nacional",
]);

function tokenize(s: string): string[] {
    return norm(s).split(" ").filter(t => t && !STOPWORDS.has(t));
}

function isSubsequenceChars(query: string, target: string): boolean {
    const q = norm(query).replace(/\s+/g, "");
    const t = norm(target).replace(/\s+/g, "");
    let i = 0;
    for (let j = 0; j < t.length && i < q.length; j++) {
        if (t[j] === q[i]) i++;
    }
    return i === q.length;
}

function scoreNameFlexible(name: string, query: string): number {
    const n = norm(name);
    const q = norm(query);
    if (!q) return 0;

    const nameTokens = tokenize(name);
    const queryTokens = tokenize(query);
    if (!nameTokens.length || !queryTokens.length) return 0;

    let hits = 0;
    let prefixHits = 0;

    for (const tq of queryTokens) {
        const hit = nameTokens.find(nt => nt.includes(tq));
        if (hit) {
            hits++;
            if (hit.startsWith(tq)) prefixHits++;
        }
    }

    if (hits < queryTokens.length) {
        const qLetters = q.replace(/\s+/g, "");
        const nLetters = n.replace(/\s+/g, "");
        if (qLetters.length >= 6 && isSubsequenceChars(qLetters, nLetters)) {
            return 80 + Math.min(20, qLetters.length);
        }
        return 0;
    }

    let score = 0;
    if (n.startsWith(q)) score += 120;
    if (n.includes(q)) score += 60;

    score += hits * 25 + prefixHits * 10;

    let inOrder = 0, idx = 0;
    for (const tq of queryTokens) {
        const pos = nameTokens.findIndex((nt, i) => i >= idx && nt.includes(tq));
        if (pos >= idx && pos !== -1) { inOrder++; idx = pos + 1; }
    }
    score += inOrder * 6;

    score -= Math.max(0, nameTokens.length - queryTokens.length) * 2;
    return Math.max(1, score);
}

export default function TopDistrictFilter({
                                              districts,
                                              pois,
                                              onPick,
                                              placeholder = "Procurar…",
                                              loadingPois = false,
                                          }: Props) {
    const [open, setOpen] = useState(false);
    const [typedQuery, setTypedQuery] = useState("");
    const [previewQuery, setPreviewQuery] = useState<string | null>(null);
    const inputValue = previewQuery ?? typedQuery;
    const [activeIdx, setActiveIdx] = useState(0);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    const searchIndex = useMemo<SearchItem[]>(() => {
        const ds: SearchItem[] = (districts ?? []).map((name) => ({ kind: "district", name }));
        const ps: SearchItem[] = (pois ?? []).map((p) => ({
            kind: "poi",
            id: p.id,
            name: p.name,
            districtId: p.districtId ?? null,
        }));
        return [...ds, ...ps];
    }, [districts, pois]);

    const filtered = useMemo(() => {
        const q = typedQuery.trim();
        if (!q) return [];

        return searchIndex
            .map((it) => ({ it, score: scoreNameFlexible(it.name, q) }))
            .filter((x) => x.score >= 40)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((x) => x.it);
    }, [typedQuery, searchIndex]);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector(".tdf-item.is-active") as HTMLElement | null;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [activeIdx, open, filtered.length]);

    function handlePick(item: SearchItem) {
        setOpen(false);
        setPreviewQuery(null);
        setTypedQuery(item.name);
        onPick(item);
    }

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

    return (
        <div className="tdf-wrap" ref={wrapRef}>
            <span className="tdf-label">Pesquisar</span>

            <div className="tdf-inputbox">
                <input
                    className="tdf-input"
                    value={inputValue}
                    placeholder={loadingPois ? "A preparar pesquisa…" : placeholder}
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
                    <ul className="tdf-list gold-scroll" ref={listRef}>
                        {filtered.map((item, i) => (
                            <li
                                key={item.kind === "poi" ? `poi-${item.id}` : `district-${item.name}-${i}`}
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
                    }}
                >
                    Limpar
                </button>
            )}
        </div>
    );
}