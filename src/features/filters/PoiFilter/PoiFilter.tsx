import { useEffect, useMemo, useRef, useState } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import PoiGroup from "./components/PoiGroup";
import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";

import "./poiFilter.scss";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
    variant?: "top" | "panel";
    showClose?: boolean;
    onClose?: () => void;
};

const CULTURE_KEYS = ["castle", "palace", "monument", "ruins", "church"] as const satisfies readonly PoiCategory[];
const NATURE_KEYS = ["viewpoint", "park", "trail"] as const satisfies readonly PoiCategory[];
const COMMERCIAL_KEYS = ["gastronomy", "crafts", "accommodation", "event"] as const satisfies readonly PoiCategory[];

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(CULTURE_KEYS);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(NATURE_KEYS);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(COMMERCIAL_KEYS);

export type PoiDropdownItem = {
    key: PoiCategory;
    label: string;
    svg?: string | null;
    count: number;
    color?: string;
};

export default function PoiFilter({
                                      selected,
                                      onToggle,
                                      onClear,
                                      countsByCat = {},
                                      variant = "top",
                                      showClose = false,
                                      onClose,
                                  }: Props) {
    const isTop = variant === "top";

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [closeSignal, setCloseSignal] = useState(0);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setCloseSignal((n) => n + 1);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const grouped = useMemo(() => {
        const culture: PoiDropdownItem[] = [];
        const nature: PoiDropdownItem[] = [];
        const commercial: PoiDropdownItem[] = [];
        const other: PoiDropdownItem[] = [];

        for (const c of POI_CATEGORIES) {
            const key = c.key as PoiCategory;
            const item: PoiDropdownItem = {
                key,
                label: c.label,
                svg: POI_ICON_SVG_RAW[key] ?? null,
                count: countsByCat[key] ?? 0,
                color: CATEGORY_COLORS[key] || "#777",
            };

            if (CULTURE_SET.has(key)) culture.push(item);
            else if (NATURE_SET.has(key)) nature.push(item);
            else if (COMMERCIAL_SET.has(key)) commercial.push(item);
            else other.push(item);
        }

        return { culture, nature, commercial, other };
    }, [countsByCat]);

    const handleClear = () => {
        onClear();
        setCloseSignal((n) => n + 1);
    };

    if (!isTop) {
        return (
            <div className="poi-filter poi-filter--panel" data-poi-filter="panel" ref={wrapRef}>
                <div className="poi-filter__inner poi-filter__inner--panel">
                    {showClose && <div className="poi-spacer" />}
                    {showClose && (
                        <button
                            className="gold-close gold-close--left"
                            onClick={onClose}
                            aria-label="Voltar"
                            title="Voltar"
                            type="button"
                        >
                            ←
                        </button>
                    )}

                    {POI_CATEGORIES.map(({ key, label }) => {
                        const k = key as PoiCategory;
                        const checked = selected.has(k);
                        const color = CATEGORY_COLORS[k] || "#777";
                        const count = countsByCat[k] ?? 0;
                        const svg = POI_ICON_SVG_RAW[k];

                        return (
                            <label
                                key={k}
                                className={`poi-chip ${checked ? "poi-chip--on" : ""}`}
                                title={label}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <input type="checkbox" checked={checked} onChange={() => onToggle(k)} style={{ accentColor: color }} />
                                {svg && (
                                    <span className="poi-chip__icon" style={{ color }} dangerouslySetInnerHTML={{ __html: svg }} />
                                )}
                                <span className="poi-chip__text">
                                    <span className="poi-chip__label">{label}</span>
                                    <em className="poi-chip__count">{count}</em>
                                </span>
                            </label>
                        );
                    })}

                    <button type="button" className="btn-clear" onClick={handleClear}>
                        Limpar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="poi-filter poi-filter--top" data-poi-filter="top" ref={wrapRef}>
            <div className="poi-filter__inner">
                {/* SETA À ESQUERDA (substitui o X) */}
                {showClose && (
                    <button
                        className="gold-close gold-close--left"
                        onClick={onClose}
                        aria-label="Voltar à Home"
                        title="Voltar à Home"
                        type="button"
                    >
                        ←
                    </button>
                )}

                {grouped.culture.length > 0 && (
                    <PoiGroup label="Cultura" items={grouped.culture} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                )}

                {grouped.nature.length > 0 && (
                    <PoiGroup label="Natureza" items={grouped.nature} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                )}

                {grouped.commercial.length > 0 && (
                    <PoiGroup label="Comercial" items={grouped.commercial} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                )}

                <button type="button" className="btn-clear" onClick={handleClear}>
                    Limpar
                </button>

                {/* ✅ empurra o user menu para a direita */}
                <div className="poi-spacer" />
                <TopRightUserMenu />
            </div>
        </div>
    );
}