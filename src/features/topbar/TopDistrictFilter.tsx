// src/features/topbar/TopDistrictFilter.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/logo.png";
import "./TopDistrictFilter.scss";

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

const STOPWORDS = new Set([
    "o", "a", "os", "as", "um", "uma", "uns", "umas",
    "de", "do", "da", "dos", "das", "d", "e",
    "no", "na", "nos", "nas",
    "ao", "aos", "à", "às",
    "para", "por", "em",
    "the", "of", "and",
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

/** devolve uma pontuação; 0 = não relevante */
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

type SearchItem = { kind: "district"; name: string };

export default function TopDistrictFilter({
                                              allNames,
                                              onPick,
                                              placeholder = "Procurar distrito…",
                                          }: Props) {
    const [open, setOpen] = useState(false);

    const [typedQuery, setTypedQuery] = useState("");
    const [previewQuery, setPreviewQuery] = useState<string | null>(null);
    const inputValue = previewQuery ?? typedQuery;

    const [activeIdx, setActiveIdx] = useState(0);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    // ---------- índice (só distritos) ----------
    const searchIndex = useMemo<SearchItem[]>(() => {
        return allNames.map((n) => ({ kind: "district", name: n }));
    }, [allNames]);

    // ---------- resultados ----------
    const filtered = useMemo(() => {
        const qRaw = typedQuery;
        const q = norm(qRaw);
        if (!q) return [] as SearchItem[];

        return searchIndex
            .map(it => {
                const score = scoreNameFlexible(it.name, qRaw);
                return { it, score };
            })
            .filter(x => x.score >= 40)
            .sort((a, b) => b.score - a.score)
            .slice(0, 30)
            .map(x => x.it);
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
            setActiveIdx(i => {
                const next = Math.min(i + 1, filtered.length - 1);
                setPreviewQuery(filtered[next]?.name ?? null);
                return next;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx(i => {
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

    function handlePick(item: SearchItem) {
        setOpen(false);
        setPreviewQuery(null);
        setTypedQuery(item.name);
        onPick(item.name);
    }

    return (
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
                    <ul
                        className="tdf-list gold-scroll"
                        role="listbox"
                        ref={listRef}
                    >
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
                        onPick(""); // limpa seleção de distrito no Home
                    }}
                >
                    Limpar
                </button>
            )}
        </div>
    );
}