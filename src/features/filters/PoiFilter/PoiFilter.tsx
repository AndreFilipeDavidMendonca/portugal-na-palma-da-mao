// src/features/filters/PoiFilter.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { POI_CATEGORIES, PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
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

    const [openGroup, setOpenGroup] = useState<"culture" | "nature" | "commercial" | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpenGroup(null);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const nodeCategories = useMemo(() => POI_CATEGORIES, []);

    const { cultureCats, natureCats, commercialCats } = useMemo(() => {
        const culture: typeof POI_CATEGORIES = [];
        const nature: typeof POI_CATEGORIES = [];
        const commercial: typeof POI_CATEGORIES = [];
        const others: typeof POI_CATEGORIES = [];

        for (const c of nodeCategories) {
            const k = c.key;
            if (CULTURE_SET.has(k)) culture.push(c);
            else if (NATURE_SET.has(k)) nature.push(c);
            else if (COMMERCIAL_SET.has(k)) commercial.push(c);
            else others.push(c);
        }

        return { cultureCats: culture, natureCats: nature, commercialCats: commercial, otherCats: others };
    }, [nodeCategories]);

    const renderChip = (key: PoiCategory, label: string) => {
        const checked = selected.has(key);
        const color = CATEGORY_COLORS[key] || "#777";
        const count = countsByCat[key] ?? 0;
        const svg = POI_ICON_SVG_RAW[key];

        return (
            <label
                key={key}
                className={`poi-chip ${checked ? "poi-chip--on" : ""}`}
                title={label}
                onMouseDown={(e) => e.preventDefault()}
            >
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(key)}
                    style={{ accentColor: color }}
                />
                {svg && (
                    <span
                        className="poi-chip__icon"
                        style={{ color }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                )}
                <span className="poi-chip__label">{label}</span>
                <em className="poi-chip__count">{count}</em>
            </label>
        );
    };

    const handleClear = () => {
        onClear();
        setOpenGroup(null);
    };

    const contentTop = (
        <>

            {cultureCats.length > 0 && (
                <div className="poi-group">
                    <button
                        type="button"
                        className={`poi-chip poi-chip--group ${openGroup === "culture" ? "poi-chip--group-open" : ""}`}
                        onClick={() => setOpenGroup((g) => (g === "culture" ? null : "culture"))}
                    >
                        <span className="poi-chip__label">Cultura</span>
                        <span className="poi-chip__arrow">▾</span>
                    </button>

                    {openGroup === "culture" && (
                        <div className="poi-group-dropdown">
                            {cultureCats.map(({ key, label }) => renderChip(key, label))}
                        </div>
                    )}
                </div>
            )}

            {natureCats.length > 0 && (
                <div className="poi-group">
                    <button
                        type="button"
                        className={`poi-chip poi-chip--group ${openGroup === "nature" ? "poi-chip--group-open" : ""}`}
                        onClick={() => setOpenGroup((g) => (g === "nature" ? null : "nature"))}
                    >
                        <span className="poi-chip__label">Natureza</span>
                        <span className="poi-chip__arrow">▾</span>
                    </button>

                    {openGroup === "nature" && (
                        <div className="poi-group-dropdown">
                            {natureCats.map(({ key, label }) => renderChip(key as PoiCategory, label))}
                        </div>
                    )}
                </div>
            )}

            {commercialCats.length > 0 && (
                <div className="poi-group">
                    <button
                        type="button"
                        className={`poi-chip poi-chip--group ${openGroup === "commercial" ? "poi-chip--group-open" : ""}`}
                        onClick={() => setOpenGroup((g) => (g === "commercial" ? null : "commercial"))}
                    >
                        <span className="poi-chip__label">Comercial</span>
                        <span className="poi-chip__arrow">▾</span>
                    </button>

                    {openGroup === "commercial" && (
                        <div className="poi-group-dropdown">
                            {commercialCats.map(({ key, label }) => renderChip(key as PoiCategory, label))}
                        </div>
                    )}
                </div>
            )}

            <button type="button" className="btn-clear" onClick={handleClear}>
                Limpar
            </button>

            {showClose && <div className="poi-spacer" />}

            {showClose && (
                <button
                    className="gold-close"
                    onClick={onClose}
                    aria-label="Fechar distrito"
                    title="Fechar distrito"
                    type="button"
                >
                    ×
                </button>
            )}
        </>
    );

    const contentPanel = (
        <>
            {nodeCategories.map(({ key, label }) => renderChip(key as PoiCategory, label))}
            <button type="button" className="btn-clear" onClick={handleClear}>
                Limpar
            </button>
            {showClose && <div className="poi-spacer" />}
            {showClose && (
                <button className="gold-close" onClick={onClose} aria-label="Fechar" title="Fechar" type="button">
                    ×
                </button>
            )}
        </>
    );

    return (
        <div
            className={`poi-filter ${isTop ? "poi-filter--top" : "poi-filter--panel"}`}
            data-poi-filter={isTop ? "top" : "panel"}
            ref={wrapRef}
        >
            <div className="poi-filter__inner">{isTop ? contentTop : contentPanel}</div>
        </div>
    );
}