// src/features/map/PoiFilter.tsx
import { POI_CATEGORIES, PoiCategory } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { CATEGORY_COLORS } from "@/utils/constants";
import React from "react";

type Props = {
    selected: Set<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    /** opcional: mostrar contagem por categoria */
    countsByCat?: Partial<Record<PoiCategory, number>>;
    /** "top" = barra horizontal fixa; "panel" = o painel antigo */
    variant?: "top" | "panel";
};

export default function PoiFilter({
                                      selected,
                                      onToggle,
                                      onClear,
                                      countsByCat = {},
                                      variant = "top",
                                  }: Props) {
    const isTop = variant === "top";

    const wrapStyle: React.CSSProperties = isTop
        ? {
            position: "sticky",
            top: 0,
            zIndex: 10000,
            background: "rgba(255,255,255,.96)",
            backdropFilter: "saturate(120%) blur(2px)",
            borderBottom: "1px solid #eee",
        }
        : {
            background: "rgba(255,255,255,0.95)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 6px 16px rgba(0,0,0,.15)",
        };

    const innerStyle: React.CSSProperties = isTop
        ? {
            display: "flex",
            gap: 10,
            alignItems: "center",
            padding: "10px 14px",
            overflowX: "auto",
            scrollbarWidth: "thin",
        }
        : {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))", // 3 colunas
            gap: 8,
        };

    const chipStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        border: "1px solid #E0E0E0",
        borderRadius: 12,
        background: "#fff",
        whiteSpace: "nowrap",
        userSelect: "none",
    };

    const chipOnStyle: React.CSSProperties = {
        background: "#F3F6FF",
        borderColor: "#C5CAE9",
    };

    return (
        <div style={wrapStyle}>
            <div style={innerStyle}>
                {POI_CATEGORIES.filter(c => c.kind === "node").map(({ key, label }) => {
                    const checked = selected.has(key);
                    const svg = POI_ICON_SVG_RAW[key];
                    const color = CATEGORY_COLORS[key] || "#777";
                    const count = countsByCat[key] ?? 0;

                    return (
                        <label
                            key={key}
                            style={{ ...chipStyle, ...(checked ? chipOnStyle : null) }}
                            title={label}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle(key)}
                                style={{
                                    width: 13,
                                    height: 13,
                                    transform: "translateY(-0.5px)",
                                    accentColor: color, // usa a cor da categoria, se suportado
                                    cursor: "pointer"
                                }}
                            />
                            {svg && (
                                <span
                                    style={{
                                        width: 18,
                                        height: 18,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color,
                                        lineHeight: 0,
                                    }}
                                    dangerouslySetInnerHTML={{ __html: svg }}
                                />
                            )}
                            <span>{label}</span>
                            <em style={{ marginLeft: 6, fontStyle: "normal", fontSize: 12, opacity: 0.65 }}>
                                {count}
                            </em>
                        </label>
                    );
                })}

                {/* botão limpar */}
                <button
                    onClick={onClear}
                    style={{
                        ...chipStyle,
                        borderColor: "#ddd",
                        cursor: "pointer",
                        fontWeight: 600,
                    }}
                >
                    Limpar
                </button>
            </div>
        </div>
    );
}