// src/features/filters/PoiDropdown.tsx
import React, { useEffect } from "react";
import type { RefObject } from "react";
import type { PoiCategory } from "@/utils/constants";

type PoiDropdownItem = {
    key: PoiCategory;
    label: string;
    count: number;
    svg?: string | null;
};

type Props = {
    anchorRef: RefObject<HTMLElement>; // ou RefObject<HTMLDivElement> se for sempre div
    items: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;
    onToggle: (key: PoiCategory) => void;
    onClose: () => void;
};

export default function PoiDropdown({
                                        anchorRef,
                                        items,
                                        selected,
                                        onToggle,
                                        onClose,
                                    }: Props) {
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const anchor = anchorRef.current;
            if (!anchor) return;

            if (!anchor.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [anchorRef, onClose]);

    return (
        <div className="poi-group-dropdown">
            {items.map((c) => (
                <label
                    key={c.key}
                    className={`poi-chip ${selected.has(c.key) ? "poi-chip--on" : ""}`}
                    onMouseDown={(e) => e.preventDefault()} // não roubar o foco
                    onClick={() => onToggle(c.key)}
                >
                    {c.svg && (
                        <span
                            className="poi-chip__icon"
                            dangerouslySetInnerHTML={{ __html: c.svg }}
                        />
                    )}
                    <span className="poi-chip__label">{c.label}</span>
                    <em className="poi-chip__count">{c.count}</em>
                </label>
            ))}
        </div>
    );
}