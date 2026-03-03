import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";

import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import Chip from "@/components/Chip/Chip";
import Button from "@/components/Button/Button";

import "./PoiFiltersMobileDropdown.scss";

type NavMode = "home" | "back";

type Props = {
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    onClear: () => void;
    countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;

    navMode: NavMode;
    onNav: () => void;

    onAnySelection?: () => void;
};

type TabKey = "culture" | "nature" | "commercial";

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set(["castle", "palace", "monument", "ruins", "church"]);
const NATURE_SET: ReadonlySet<PoiCategory> = new Set(["viewpoint", "park", "trail"]);
const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set(["gastronomy", "crafts", "accommodation", "event"]);

function setEquals(a: ReadonlySet<any>, b: ReadonlySet<any>) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}

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

    // ✅ tab active
    const [activeTab, setActiveTab] = useState<TabKey>("culture");

    // ✅ staging (draft)
    const [draft, setDraft] = useState<Set<PoiCategory>>(new Set(selected));

    // abre = clona seleção atual para draft
    const openPanel = useCallback(() => {
        setDraft(new Set(selected));
        setOpen(true);
    }, [selected]);

    // fecha com cancel (reverte)
    const closeCancel = useCallback(() => {
        setOpen(false);
        setDraft(new Set(selected));
    }, [selected]);

    const closeApply = useCallback(() => {
        setOpen(false);
    }, []);

    useEffect(() => {
        const onClickOutside = (e: Event) => {
            if (!open) return;
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) closeCancel();
        };

        const onKey = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === "Escape") closeCancel();
        };

        document.addEventListener("pointerdown", onClickOutside);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onClickOutside);
            document.removeEventListener("keydown", onKey);
        };
    }, [open, closeCancel]);

    const grouped = useMemo(() => {
        const culture: PoiCategory[] = [];
        const nature: PoiCategory[] = [];
        const commercial: PoiCategory[] = [];

        for (const c of POI_CATEGORIES) {
            const key = c.key as PoiCategory;
            if (CULTURE_SET.has(key)) culture.push(key);
            else if (NATURE_SET.has(key)) nature.push(key);
            else if (COMMERCIAL_SET.has(key)) commercial.push(key);
        }
        return { culture, nature, commercial };
    }, []);

    const itemsForTab: PoiCategory[] = useMemo(() => {
        if (activeTab === "culture") return grouped.culture;
        if (activeTab === "nature") return grouped.nature;
        return grouped.commercial;
    }, [activeTab, grouped]);

    const tabLabel = (t: TabKey) => (t === "culture" ? "Culture" : t === "nature" ? "Nature" : "Commercial");

    const toggleDraft = (k: PoiCategory) => {
        setDraft((prev) => {
            const next = new Set(prev);
            if (next.has(k)) next.delete(k);
            else next.add(k);
            return next;
        });
    };

    const handleClear = () => {
        setDraft(new Set());
    };

    // ✅ aplica diferenças (mantém a tua API onToggle)
    const handleApply = () => {
        // se quiseres: se nada mudou, só fecha
        if (setEquals(draft, selected)) {
            closeApply();
            return;
        }

        // aplicar diffs com onToggle
        const next = draft;
        const cur = selected;

        for (const k of cur) {
            if (!next.has(k)) onToggle(k);
        }
        for (const k of next) {
            if (!cur.has(k)) onToggle(k);
        }

        onAnySelection?.();
        closeApply();
    };

    const navLabel = navMode === "home" ? "Voltar à Home" : "Voltar ao mapa";
    const navIcon = navMode === "home" ? "⌂" : "←";

    return (
        <div className="poi-filters-mobile" ref={wrapRef}>
            <Button
                variant="ghost"
                size="xs"
                pill
                className="gold-close gold-close--left poi-filters-mobile__home"
                onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    onNav();
                }}
                aria-label={navLabel}
                title={navLabel}
                type="button"
            >
                {navIcon}
            </Button>

            {/* botão parent */}
            <Chip
                variant="poi"
                pill={false}
                group
                open={open}
                className="poi-filters-mobile__btn poi-filters-mobile__btn--parent"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    if (open) closeCancel();
                    else openPanel();
                }}
            >
                <span className="poi-chip__label">Filtros</span>
                <span className="poi-chip__arrow">▾</span>
            </Chip>

            <div className="poi-spacer poi-filters-mobile__spacer" />
            <TopRightUserMenu />

            {open && (
                <div className="poi-filters-modal" role="dialog" aria-label="Filters">
                    {/* header */}
                    <div className="poi-filters-modal__header">
                        <button
                            type="button"
                            className="poi-filters-modal__x"
                            onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeCancel();
                            }}
                            aria-label="Close"
                            title="Close"
                        >
                            ✕
                        </button>

                        <div className="poi-filters-modal__title">Filters</div>

                        <span className="poi-filters-modal__spacer" />
                    </div>

                    {/* segmented tabs */}
                    <div className="poi-filters-modal__tabs" role="tablist" aria-label="Filter categories">
                        {(["culture", "nature", "commercial"] as TabKey[]).map((t) => {
                            const active = activeTab === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    className={["poi-tab", active ? "poi-tab--active" : ""].filter(Boolean).join(" ")}
                                    onClick={() => setActiveTab(t)}
                                    role="tab"
                                    aria-selected={active}
                                >
                                    {tabLabel(t)}
                                </button>
                            );
                        })}
                    </div>

                    {/* list */}
                    <div className="poi-filters-modal__list">
                        {itemsForTab.map((k) => {
                            const cat = POI_CATEGORIES.find((c) => (c.key as PoiCategory) === k);
                            const label = cat?.label ?? String(k);
                            const count = countsByCat[k] ?? 0;
                            const color = CATEGORY_COLORS[k] || "var(--gold)";
                            const svg = POI_ICON_SVG_RAW[k] ?? null;

                            const checked = draft.has(k);

                            return (
                                <button
                                    key={k}
                                    type="button"
                                    className={["poi-row", checked ? "poi-row--selected" : ""].filter(Boolean).join(" ")}
                                    onClick={() => toggleDraft(k)}
                                >
                  <span className="poi-row__left">
                    <span className="poi-row__icon" style={{ color }} aria-hidden="true">
                      {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : null}
                    </span>
                    <span className="poi-row__label">{label}</span>
                  </span>

                                    <span className="poi-row__badge">{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* footer */}
                    <div className="poi-filters-modal__footer">
                        <button type="button" className="poi-btn-clear" onClick={handleClear}>
                            Clear Filters
                        </button>

                        <button
                            type="button"
                            className="poi-btn-apply"
                            onClick={handleApply}
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}