import { useEffect, useMemo, useRef, useState } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import PoiGroup from "./components/PoiGroup";
import type { PoiDropdownItem } from "./PoiFilter";

import "./PoiFiltersMobileDropdown.scss";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
};

const CULTURE_KEYS = ["castle", "palace", "monument", "ruins", "church"] as const satisfies readonly PoiCategory[];
const NATURE_KEYS = ["viewpoint", "park", "trail"] as const satisfies readonly PoiCategory[];
const COMMERCIAL_KEYS = ["gastronomy", "crafts", "accommodation", "event"] as const satisfies readonly PoiCategory[];

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(CULTURE_KEYS);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(NATURE_KEYS);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(COMMERCIAL_KEYS);

export default function PoiFiltersMobileDropdown({
                                                     selected,
                                                     onToggle,
                                                     onClear,
                                                     countsByCat = {},
                                                 }: Props) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [closeSignal, setCloseSignal] = useState(0);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setCloseSignal((n) => n + 1);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false);
                setCloseSignal((n) => n + 1);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClickOutside);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const grouped = useMemo(() => {
        const culture: PoiDropdownItem[] = [];
        const nature: PoiDropdownItem[] = [];
        const commercial: PoiDropdownItem[] = [];

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
        }

        return { culture, nature, commercial };
    }, [countsByCat]);

    const handleClear = () => {
        onClear();
        setCloseSignal((n) => n + 1);
        setOpen(false);
    };

    return (
        <div className="poi-filters-mobile" ref={wrapRef}>
            <button
                type="button"
                className={`poi-chip poi-chip--group poi-filters-mobile__btn ${open ? "poi-chip--group-open" : ""}`}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="poi-chip__label">Filters</span>
                <span className="poi-chip__arrow">▾</span>
            </button>

            {open && (
                <div className="poi-filters-mobile__panel">
                    <div className="poi-filters-mobile__panel-inner">
                        {grouped.culture.length > 0 && (
                            <PoiGroup
                                label="Cultura"
                                items={grouped.culture}
                                selected={selected}
                                onToggle={onToggle}
                                closeSignal={closeSignal}
                            />
                        )}

                        {grouped.nature.length > 0 && (
                            <PoiGroup
                                label="Natureza"
                                items={grouped.nature}
                                selected={selected}
                                onToggle={onToggle}
                                closeSignal={closeSignal}
                            />
                        )}

                        {grouped.commercial.length > 0 && (
                            <PoiGroup
                                label="Comercial"
                                items={grouped.commercial}
                                selected={selected}
                                onToggle={onToggle}
                                closeSignal={closeSignal}
                            />
                        )}

                        <button type="button" className="btn-clear poi-filters-mobile__clear" onClick={handleClear}>
                            Limpar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}