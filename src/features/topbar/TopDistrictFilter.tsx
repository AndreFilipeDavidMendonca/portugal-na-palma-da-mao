import { useEffect, useMemo, useRef, useState } from "react";
import logo from "@/assets/logo.png";
import "./TopDistrictFilter.scss";

type Props = {
    allNames: string[];
    onPick: (name: string) => void;
    placeholder?: string;
};

export default function TopDistrictFilter({
                                              allNames,
                                              onPick,
                                              placeholder = "Procurar distrito…",
                                          }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIdx, setActiveIdx] = useState(0);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    // filtra por texto (acentos/maiúsculas tolerantes)
    const filtered = useMemo(() => {
        const norm = (s: string) =>
            s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        const q = norm(query);
        const list = !q ? allNames : allNames.filter((n) => norm(n).includes(q));
        return list.slice(0, 30);
    }, [allNames, query]);

    // click fora fecha dropdown
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    function pick(name: string) {
        onPick(name);
        setQuery(name);
        setOpen(false);
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
        }
        if (!filtered.length) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            pick(filtered[activeIdx] || query);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="tdf-wrap" ref={wrapRef}>
            <div className="tdf-logo">
                <img src={logo} alt=".pt" />
            </div>

            <span className="tdf-label">Distrito</span>

            <div className="tdf-inputbox">
                <input
                    className="tdf-input"
                    value={query}
                    placeholder={placeholder}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setActiveIdx(0);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />

                {open && filtered.length > 0 && (
                    <ul className="tdf-list" role="listbox">
                        {filtered.map((n, i) => (
                            <li
                                key={n}
                                role="option"
                                aria-selected={i === activeIdx}
                                className={`tdf-item ${i === activeIdx ? "is-active" : ""}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(n);
                                }}
                                onMouseEnter={() => setActiveIdx(i)}
                            >
                                {n}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}