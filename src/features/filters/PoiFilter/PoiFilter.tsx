import { useEffect, useMemo, useRef, useState } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import PoiGroup from "./components/PoiGroup";
import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import Chip from "@/components/Chip/Chip";
import Button from "@/components/Button/Button";
import Checkbox from "@/components/Input/Checkbox/Checkbox";

import "./poiFilter.scss";

type NavMode = "home" | "back";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
    variant?: "top" | "panel";

    navMode?: NavMode;
    onNav?: () => void;

    // opcional: se quiseres que ao filtrar também volte ao mapa/feche galeria
    onAnySelection?: () => void;
};

export type PoiDropdownItem = {
    key: PoiCategory;
    label: string;
    svg?: string | null;
    count: number;
    color?: string;
};

/* -----------------------------
   Category groups
------------------------------ */
const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(["castle", "palace", "monument", "ruins", "church"]);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(["viewpoint", "park", "trail"]);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(["gastronomy", "crafts", "accommodation", "event"]);

/* -----------------------------
   Icons
------------------------------ */
function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 11.5L12 4.5L20.5 11.5" />
            <path d="M8 11.5V20H16V11.5" />
        </svg>
    );
}

function BackIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
        </svg>
    );
}

export default function PoiFilter({
                                      selected,
                                      onToggle,
                                      onClear,
                                      countsByCat = {},
                                      variant = "top",
                                      navMode = "home",
                                      onNav,
                                      onAnySelection,
                                  }: Props) {
    const isTop = variant === "top";
    const wrapRef = useRef<HTMLDivElement | null>(null);

    // “broadcast” para fechar dropdowns abertos (grupos)
    const [closeSignal, setCloseSignal] = useState(0);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setCloseSignal((n) => n + 1);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const grouped = useMemo(() => {
        const culture: PoiDropdownItem[] = [];
        const nature: PoiDropdownItem[] = [];
        const commercial: PoiDropdownItem[] = [];
        const other: PoiDropdownItem[] = [];

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
            else other.push(item);
        }

        return { culture, nature, commercial, other };
    }, [countsByCat]);

    const handleClear = () => {
        onClear();
        onAnySelection?.();
        setCloseSignal((n) => n + 1);
    };

    // ✅ toggle que fecha dropdowns e (opcionalmente) faz “voltar ao mapa/fechar galeria”
    const handleToggle = (k: PoiCategory) => {
        onToggle(k);
        onAnySelection?.();
        setCloseSignal((n) => n + 1);
    };

    /* -----------------------------
       PANEL variant (chips list)
    ------------------------------ */
    if (!isTop) {
        return (
            <div className="poi-filter poi-filter--panel" data-poi-filter="panel" ref={wrapRef}>
                <div className="poi-filter__inner poi-filter__inner--panel">
                    {POI_CATEGORIES.map(({ key, label }) => {
                        const k = key as PoiCategory;
                        const checked = selected.has(k);
                        const color = CATEGORY_COLORS[k] || "#777";
                        const count = countsByCat[k] ?? 0;
                        const svg = POI_ICON_SVG_RAW[k];

                        return (
                            <Chip
                                as="label"
                                key={k}
                                variant="poi"
                                pill={false}
                                selected={checked}
                                title={label}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Checkbox checked={checked} onChange={() => handleToggle(k)} accent={color} />

                                {svg && <span className="poi-chip__icon" style={{ color }} dangerouslySetInnerHTML={{ __html: svg }} />}

                                <span className="poi-chip__text">
                  <span className="poi-chip__label">{label}</span>
                  <em className="poi-chip__count">{count}</em>
                </span>
                            </Chip>
                        );
                    })}

                    <Button type="button" variant="ghost" size="sm" pill className="btn-clear" onClick={handleClear}>
                        Limpar
                    </Button>
                </div>
            </div>
        );
    }

    /* -----------------------------
       TOP variant (groups dropdown)
    ------------------------------ */
    const navLabel = navMode === "home" ? "Voltar à Home" : "Voltar ao mapa";

    return (
        <div className="poi-filter poi-filter--top" data-poi-filter="top" ref={wrapRef}>
            <div className="poi-filter__inner">
                <Button type="button" variant="ghost" size="xs" pill className="gold-close gold-close--left" onClick={onNav} aria-label={navLabel} title={navLabel}>
                    {navMode === "home" ? <HomeIcon /> : <BackIcon />}
                </Button>

                {grouped.culture.length > 0 && (
                    <PoiGroup label="Cultura" items={grouped.culture} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
                )}
                {grouped.nature.length > 0 && (
                    <PoiGroup label="Natureza" items={grouped.nature} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
                )}
                {grouped.commercial.length > 0 && (
                    <PoiGroup label="Comercial" items={grouped.commercial} selected={selected} onToggle={handleToggle} closeSignal={closeSignal} />
                )}

                <Button type="button" variant="ghost" size="sm" pill className="btn-clear" onClick={handleClear}>
                        Limpar
                    </Button>

                <div className="poi-spacer" />
                <TopRightUserMenu />
            </div>
        </div>
    );
}