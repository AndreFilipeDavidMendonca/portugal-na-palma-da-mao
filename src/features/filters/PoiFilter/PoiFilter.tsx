// src/features/filters/PoiFilter.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { POI_CATEGORIES, PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import logo from "@/assets/logo.png";
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

const CULTURE_KEYS = [
    "castle",
    "palace",
    "monument",
    "ruins",
    "church",
] as const satisfies readonly PoiCategory[];

const NATURE_KEYS = [
    "viewpoint",
    "park",
    "trail",
] as const satisfies readonly PoiCategory[];

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(CULTURE_KEYS);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(NATURE_KEYS);

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

    const [openGroup, setOpenGroup] = useState<"culture" | "nature" | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    // click fora para fechar dropdowns
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) {
                setOpenGroup(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // índice base
    const nodeCategories = useMemo(() => POI_CATEGORIES, []);

    // separa em grupos (Cultura / Natureza / Outros)
    const { cultureCats, natureCats, otherCats } = useMemo(() => {
        const culture: typeof POI_CATEGORIES = [];
        const nature: typeof POI_CATEGORIES = [];
        const others: typeof POI_CATEGORIES = [];

        for (const c of nodeCategories) {
            const k = c.key;

            if (CULTURE_SET.has(k)) culture.push(c);
            else if (NATURE_SET.has(k)) nature.push(c);
            else others.push(c);
        }

        return { cultureCats: culture, natureCats: nature, otherCats: others };
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
                onMouseDown={(e) => {
                    // evita perder foco / fechar dropdown por engano
                    e.preventDefault();
                }}
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
            {/* LOGO .PT à esquerda */}
            <div className="poi-logo">
                <img src={logo} alt=".PT" />
            </div>

            {/* Grupo: Cultura */}
            {cultureCats.length > 0 && (
                <div className="poi-group">
                    <button
                        type="button"
                        className={`poi-chip poi-chip--group ${
                            openGroup === "culture" ? "poi-chip--group-open" : ""
                        }`}
                        onClick={() =>
                            setOpenGroup((g) => (g === "culture" ? null : "culture"))
                        }
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

            {/* Grupo: Natureza */}
            {natureCats.length > 0 && (
                <div className="poi-group">
                    <button
                        type="button"
                        className={`poi-chip poi-chip--group ${
                            openGroup === "nature" ? "poi-chip--group-open" : ""
                        }`}
                        onClick={() =>
                            setOpenGroup((g) => (g === "nature" ? null : "nature"))
                        }
                    >
                        <span className="poi-chip__label">Natureza</span>
                        <span className="poi-chip__arrow">▾</span>
                    </button>

                    {openGroup === "nature" && (
                        <div className="poi-group-dropdown">
                            {natureCats.map(({ key, label }) =>
                                renderChip(key as PoiCategory, label)
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Se sobrarem categorias sem grupo, mostram-se como chips normais */}
            {otherCats.map(({ key, label }) =>
                renderChip(key as PoiCategory, label)
            )}

            {/* LIMPAR logo a seguir aos chips / grupos */}
            <button type="button" className="btn-clear" onClick={handleClear}>
                Limpar
            </button>

            {/* espaço flexível para empurrar o X para o canto direito */}
            {showClose && <div className="poi-spacer" />}

            {/* X no canto direito */}
            {showClose && (
                <button
                    className="gold-close"
                    onClick={onClose}
                    aria-label="Fechar distrito"
                    title="Fechar distrito"
                >
                    ×
                </button>
            )}
        </>
    );

    //: TODO - para mobile futuramente
    const contentPanel = (
        <>
            {/* painel lateral / versão antiga: todos os chips planos */}
            {nodeCategories.map(({ key, label }) => renderChip(key as PoiCategory, label))}

            <button type="button" className="btn-clear" onClick={handleClear}>
                Limpar
            </button>

            {showClose && <div className="poi-spacer" />}
            {showClose && (
                <button
                    className="gold-close"
                    onClick={onClose}
                    aria-label="Fechar"
                    title="Fechar"
                >
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
            <div className="poi-filter__inner">
                {isTop ? contentTop : contentPanel}
            </div>
        </div>
    );
}