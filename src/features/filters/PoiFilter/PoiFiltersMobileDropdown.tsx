import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import PoiGroup from "./components/PoiGroup";
import type { PoiDropdownItem } from "./PoiFilter";
import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import Chip from "@/components/Chip/Chip";

import "./PoiFiltersMobileDropdown.scss";

type NavMode = "home" | "back";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;

    navMode: NavMode;
    onNav: () => void;

    // ✅ “clicar num filtro fecha dropdown e volta ao mapa/fecha galeria”
    onAnySelection?: () => void;
};

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(["castle", "palace", "monument", "ruins", "church"]);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(["viewpoint", "park", "trail"]);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(["gastronomy", "crafts", "accommodation", "event"]);

export default function PoiFiltersMobileDropdown({
                                                     selected,
                                                     onToggle,
                                                     onClear,
                                                     countsByCat = {},
                                                     navMode,
                                                     onNav,
                                                     onAnySelection,
                                                 }: Props) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const [closeSignal, setCloseSignal] = useState(0);

    const closeAll = useCallback(() => {
        setOpen(false);
        setCloseSignal((n) => n + 1);
    }, []);

    useEffect(() => {
        const onClickOutside = (e: Event) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) closeAll();
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeAll();
        };

        document.addEventListener("pointerdown", onClickOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onClickOutside);
            document.removeEventListener("keydown", onKey);
        };
    }, [closeAll]);

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
        onAnySelection?.();
        closeAll();
    };

    // ✅ ao escolher categoria: fecha painel + fecha grupos + volta ao mapa (se quiseres)
    const handleToggle = (k: PoiCategory) => {
        onToggle(k);
        onAnySelection?.();
        closeAll();
    };

    const navLabel = navMode === "home" ? "Voltar à Home" : "Voltar ao mapa";
    const navIcon = navMode === "home" ? "⌂" : "←";

    return (
        <div className="poi-filters-mobile" ref={wrapRef}>
            <button
                className="gold-close gold-close--left poi-filters-mobile__home"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeAll();
                    onNav();
                }}
                aria-label={navLabel}
                title={navLabel}
                type="button"
            >
                {navIcon}
            </button>

            <Chip
                variant="poi"
                pill={false}
                group
                open={open}
                className="poi-filters-mobile__btn poi-filters-mobile__btn--parent"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
            >
                <span className="poi-chip__label">Filtros</span>
                <span className="poi-chip__arrow">▾</span>
            </Chip>

            <div className="poi-spacer poi-filters-mobile__spacer" />
            <TopRightUserMenu />

            {open && (
                <div className="poi-filters-mobile__panel">
                    <div className="poi-filters-mobile__panel-inner">
                        {grouped.culture.length > 0 && (
                            <PoiGroup label="Cultura" items={grouped.culture} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
                        )}
                        {grouped.nature.length > 0 && (
                            <PoiGroup label="Natureza" items={grouped.nature} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
                        )}
                        {grouped.commercial.length > 0 && (
                            <PoiGroup label="Comercial" items={grouped.commercial} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
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