import { useEffect, useMemo, useRef, useState } from "react";
import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import { fetchSearch, type SearchItem } from "@/lib/api";
import "./TopDistrictFilter.scss";

type Props = {
    onPick: (item: SearchItem) => void;
    placeholder?: string;
};

export default function TopDistrictFilter({
                                              onPick,
                                              placeholder = "Procurar…",
                                          }: Props) {
    const [open, setOpen] = useState(false);
    const [typedQuery, setTypedQuery] = useState("");
    const [activeIdx, setActiveIdx] = useState(0);

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchItem[]>([]);

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Map<string, SearchItem[]>>(new Map());
    const reqSeqRef = useRef(0);

    const normalized = useMemo(() => typedQuery.trim(), [typedQuery]);

    // click outside
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    // scroll active into view
    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector(".tdf-item.is-active") as HTMLElement | null;
        if (el) el.scrollIntoView({ block: "nearest" });
    }, [activeIdx, open, results.length]);

    // ✅ server-side search: debounce + abort + cache
    useEffect(() => {
        const q = normalized;

        // reset
        if (q.length < 2) {
            abortRef.current?.abort();
            setResults([]);
            setLoading(false);
            setActiveIdx(0);
            return;
        }

        // cache hit
        const cached = cacheRef.current.get(q);
        if (cached) {
            setResults(cached);
            setLoading(false);
            setActiveIdx(0);
            return;
        }

        const mySeq = ++reqSeqRef.current;

        const t = window.setTimeout(async () => {
            abortRef.current?.abort();
            const ac = new AbortController();
            abortRef.current = ac;

            setLoading(true);

            try {
                const data = await fetchSearch(q, 10, ac.signal);

                // ignore stale responses
                if (mySeq !== reqSeqRef.current) return;

                const list = data ?? [];
                cacheRef.current.set(q, list);
                setResults(list);
                setActiveIdx(0);
            } catch (e: any) {
                if (e?.name === "AbortError") return;
                console.error("[search] falhou:", e);
                if (mySeq === reqSeqRef.current) setResults([]);
            } finally {
                if (mySeq === reqSeqRef.current) setLoading(false);
            }
        }, 300);

        return () => window.clearTimeout(t);
    }, [normalized]);

    function handlePick(item: SearchItem) {
        setOpen(false);
        onPick(item);
    }

    function clearQuery() {
        abortRef.current?.abort();
        setTypedQuery("");
        setResults([]);
        setOpen(false);
        setActiveIdx(0);
        requestAnimationFrame(() => inputRef.current?.focus());
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
        }
        if (e.key === "Escape") {
            setOpen(false);
            return;
        }
        if (!results.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const pickItem = results[activeIdx] || results[0];
            if (pickItem) handlePick(pickItem);
        }
    }

    const hasValue = Boolean(typedQuery);

    return (
        <div className="tdf-wrap" ref={wrapRef}>
            <span className="tdf-label">Pesquisar</span>

            <div className="tdf-inputbox">
                <input
                    ref={inputRef}
                    className="tdf-input"
                    value={typedQuery}
                    placeholder={loading ? "A pesquisar…" : placeholder}
                    onChange={(e) => {
                        setTypedQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />

                {hasValue && (
                    <button
                        type="button"
                        className="tdf-clear"
                        aria-label="Limpar pesquisa"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={clearQuery}
                    >
                        ×
                    </button>
                )}

                {open && results.length > 0 && (
                    <ul className="tdf-list gold-scroll" ref={listRef}>
                        {results.map((item, i) => (
                            <li
                                key={
                                    item.kind === "poi"
                                        ? `poi-${item.id}`
                                        : `district-${item.id ?? item.name}-${i}`
                                }
                                className={`tdf-item ${i === activeIdx ? "is-active" : ""}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handlePick(item);
                                }}
                                onMouseEnter={() => setActiveIdx(i)}
                            >
                                {item.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="tdf-spacer" />
            <TopRightUserMenu />
        </div>
    );
}