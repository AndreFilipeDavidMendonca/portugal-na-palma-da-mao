import { useEffect, useRef } from "react";
import type { PoiCategory } from "@/utils/constants";
import type { PoiDropdownItem } from "../PoiFilter";

type Props = {
    items: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;
    onToggle: (key: PoiCategory) => void;
    onClose: () => void;
};

export default function PoiDropdown({ items, selected, onToggle, onClose }: Props) {
    const panelRef = useRef<HTMLDivElement | null>(null);

    // fecha ao clicar fora
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const el = panelRef.current;
            if (!el) return;
            if (!el.contains(e.target as Node)) onClose();
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div className="poi-group-dropdown" ref={panelRef}>
            {items.map((c) => {
                const checked = selected.has(c.key);

                return (
                    <label
                        key={c.key}
                        className={`poi-chip ${checked ? "poi-chip--on" : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        title={c.label}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                                onToggle(c.key);
                                // ✅ garante fechar imediatamente após escolher
                                onClose();
                            }}
                            style={{ accentColor: c.color || "#777" }}
                        />

                        {c.svg && <span className="poi-chip__icon" style={{ color: c.color }} dangerouslySetInnerHTML={{ __html: c.svg }} />}

                        <span className="poi-chip__label">{c.label}</span>
                        <em className="poi-chip__count">{c.count}</em>
                    </label>
                );
            })}
        </div>
    );
}