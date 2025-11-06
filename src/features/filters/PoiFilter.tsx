import React, { useMemo } from "react";
import { POI_CATEGORIES, PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import logo from "@/assets/logo.png";
import "./PoiFilter.scss";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
    variant?: "top" | "panel";
    showClose?: boolean;
    onClose?: () => void;
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

    // evita recalcular em cada render
    const nodeCategories = useMemo(
        () => POI_CATEGORIES.filter((c) => c.kind === "node"),
        []
    );

    return (
        <div
            className={`poi-filter ${isTop ? "poi-filter--top" : "poi-filter--panel"}`}
            data-poi-filter={isTop ? "top" : "panel"}
        >
            <div className="poi-filter__inner">

                {/* 🟡 LOGO .PT no lado esquerdo */}
                <div className="poi-logo">
                    <img src={logo} alt=".PT" />
                </div>

                {/* categorias */}
                {nodeCategories.map(({ key, label }) => {
                    const checked = selected.has(key);
                    const color = CATEGORY_COLORS[key] || "#777";
                    const count = countsByCat[key] ?? 0;
                    const svg = POI_ICON_SVG_RAW[key];

                    return (
                        <label
                            key={key}
                            className={`poi-chip ${checked ? "poi-chip--on" : ""}`}
                            title={label}
                        >
                            {/* checkbox invisível mas acessível */}
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle(key)}
                                // accentColor é dinâmico por categoria
                                style={{ accentColor: color }}
                            />
                            {svg && (
                                <span
                                    className="poi-chip__icon"
                                    style={{ color }}
                                    // svg inline já vem sanitizado da tua lib
                                    dangerouslySetInnerHTML={{ __html: svg }}
                                />
                            )}
                            <span className="poi-chip__label">{label}</span>
                            <em className="poi-chip__count">{count}</em>
                        </label>
                    );
                })}

                {/* LIMPAR logo após as categorias */}
                <button type="button" className="poi-clear" onClick={onClear}>
                    Limpar
                </button>

                {/* espaço flexível para empurrar o X */}
                {showClose && <div className="poi-spacer" />}

                {/* X encostado à direita */}
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
            </div>
        </div>
    );
}