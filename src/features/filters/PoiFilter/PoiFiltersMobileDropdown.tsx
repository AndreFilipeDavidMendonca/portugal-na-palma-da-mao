import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import PoiGroup from "./components/PoiGroup";
import type { PoiDropdownItem } from "./PoiFilter";

import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import "./PoiFiltersMobileDropdown.scss";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
    onClose: () => void;
};

const CULTURE_KEYS = ["castle", "palace", "monument", "ruins", "church"] as const satisfies readonly PoiCategory[];
const NATURE_KEYS = ["viewpoint", "park", "trail"] as const satisfies readonly PoiCategory[];
const COMMERCIAL_KEYS = ["gastronomy", "crafts", "accommodation", "event"] as const satisfies readonly PoiCategory[];

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(CULTURE_KEYS);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(NATURE_KEYS);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(COMMERCIAL_KEYS);

export default function PoiFiltersMobileDropdown({ selected, onToggle, onClear, onClose, countsByCat = {} }: Props) {
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [closeSignal, setCloseSignal] = useState(0);

    useEffect(() => {
        function onClickOutside(e: Event) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) {
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

        document.addEventListener("pointerdown", onClickOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onClickOutside);
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

    const goHome = () => {
        setOpen(false);
        setCloseSignal((n) => n + 1);
        onClose();
        navigate("/", { replace: true });
    };

    return (
        <div className="poi-filters-mobile" ref={wrapRef}>
            <button
                className="gold-close gold-close--left poi-filters-mobile__home"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goHome();
                }}
                aria-label="Voltar à Home"
                title="Voltar à Home"
                type="button"
            >
                ←
            </button>

            <button
                type="button"
                className={`poi-chip poi-chip--group poi-filters-mobile__btn poi-filters-mobile__btn--parent ${open ? "poi-chip--group-open" : ""}`}
                onPointerDown={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                <span className="poi-chip__label">Filters</span>
                <span className="poi-chip__arrow">▾</span>
            </button>

            <div className="poi-spacer poi-filters-mobile__spacer" />
            <TopRightUserMenu />

            {open && (
                <div className="poi-filters-mobile__panel">
                    <div className="poi-filters-mobile__panel-inner">
                        {grouped.culture.length > 0 && (
                            <PoiGroup label="Cultura" items={grouped.culture} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                        )}

                        {grouped.nature.length > 0 && (
                            <PoiGroup label="Natureza" items={grouped.nature} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                        )}

                        {grouped.commercial.length > 0 && (
                            <PoiGroup label="Comercial" items={grouped.commercial} selected={selected} onToggle={onToggle} closeSignal={closeSignal} />
                        )}

                        <button type="button" className="btn-clear poi-filters-mobile__clear" onPointerDown={(e) => e.stopPropagation()} onClick={handleClear}>
                            Limpar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}