import { useEffect } from "react";
import type { RefObject } from "react";
import type { PoiCategory } from "@/utils/constants";
import type { PoiDropdownItem } from "../PoiFilter";

type Props = {
    anchorRef: RefObject<HTMLDivElement | null>;
    items: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;
    onToggle: (key: PoiCategory) => void;
    onClose: () => void;
};

export default function PoiDropdown({ anchorRef, items, selected, onToggle, onClose }: Props) {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const anchor = anchorRef.current;
            if (!anchor) return;
            if (!anchor.contains(e.target as Node)) onClose();
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [anchorRef, onClose]);

    return (
        <div className="poi-group-dropdown">
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
                            onChange={() => onToggle(c.key)}
                            style={{ accentColor: c.color || "#777" }}
                        />

                        {c.svg && (
                            <span className="poi-chip__icon" style={{ color: c.color }} dangerouslySetInnerHTML={{ __html: c.svg }} />
                        )}

                        <span className="poi-chip__label">{c.label}</span>
                        <em className="poi-chip__count">{c.count}</em>
                    </label>
                );
            })}
        </div>
    );
}