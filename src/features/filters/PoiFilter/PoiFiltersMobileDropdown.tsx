import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { paintPoiIconSvg } from "@/utils/poiSvg";

import PoiGroup from "./components/PoiGroup";
import type { PoiDropdownItem } from "./PoiFilter";
import TopRightUserMenu from "@/features/topbar/TopRightUserMenu";
import Chip from "@/components/Chip/Chip";
import Button from "@/components/Button/Button";

import "./PoiFiltersMobileDropdown.scss";

type NavMode = "home" | "back";

type Props = {
  selected: ReadonlySet<PoiCategory>;
  onToggle: (category: PoiCategory) => void;
  onClear: () => void;
  countsByCat?: Readonly<Partial<Record<PoiCategory, number>>>;
  navMode: NavMode;
  onNav: () => void;
  onAnySelection?: () => void;
};

const CULTURE_SET: ReadonlySet<PoiCategory> = new Set([
  "castle",
  "palace",
  "monument",
  "ruins",
  "church",
]);

const NATURE_SET: ReadonlySet<PoiCategory> = new Set([
  "viewpoint",
  "park",
  "trail",
]);

const COMMERCIAL_SET: ReadonlySet<PoiCategory> = new Set([
  "gastronomy",
  "crafts",
  "accommodation",
  "event",
]);

function buildItem(
  key: PoiCategory,
  label: string,
  countsByCat: Readonly<Partial<Record<PoiCategory, number>>>
): PoiDropdownItem {
  const color = CATEGORY_COLORS[key] || "#777";
  const rawSvg = POI_ICON_SVG_RAW[key] ?? null;
  const svg = rawSvg ? paintPoiIconSvg(rawSvg, color) : null;

  return {
    key,
    label,
    svg,
    count: countsByCat[key] ?? 0,
    color,
  };
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
  const [closeSignal, setCloseSignal] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const closeAll = useCallback(() => {
    setOpen(false);
    setCloseSignal((n) => n + 1);
  }, []);

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        closeAll();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeAll]);

  const grouped = useMemo(() => {
    const culture: PoiDropdownItem[] = [];
    const nature: PoiDropdownItem[] = [];
    const commercial: PoiDropdownItem[] = [];

    for (const { key, label } of POI_CATEGORIES) {
      const category = key as PoiCategory;
      const item = buildItem(category, label, countsByCat);

      if (CULTURE_SET.has(category)) {
        culture.push(item);
      } else if (NATURE_SET.has(category)) {
        nature.push(item);
      } else if (COMMERCIAL_SET.has(category)) {
        commercial.push(item);
      }
    }

    return { culture, nature, commercial };
  }, [countsByCat]);

  const handleNav = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      closeAll();
      onNav();
    },
    [closeAll, onNav]
  );

  const handlePanelToggle = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();
      setOpen((prev) => !prev);
    },
    []
  );

  const handleClear = useCallback(() => {
    onClear();
    onAnySelection?.();
    closeAll();
  }, [onClear, onAnySelection, closeAll]);

  const handleToggle = useCallback(
    (category: PoiCategory) => {
      onToggle(category);
      onAnySelection?.();
      closeAll();
    },
    [onToggle, onAnySelection, closeAll]
  );

  const navLabel = navMode === "home" ? "Voltar à Home" : "Voltar ao mapa";
  const navIcon = navMode === "home" ? "⌂" : "←";

  return (
    <div className="poi-filters-mobile" ref={wrapRef}>
      <Button
        variant="ghost"
        size="xs"
        pill
        className="gold-close gold-close--left poi-filters-mobile__home"
        onPointerDown={handleNav}
        aria-label={navLabel}
        title={navLabel}
        type="button"
      >
        {navIcon}
      </Button>

      <Chip
        variant="poi"
        pill={false}
        group
        open={open}
        className="poi-filters-mobile__btn poi-filters-mobile__btn--parent"
        onPointerDown={handlePanelToggle}
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
              <PoiGroup
                label="Cultura"
                items={grouped.culture}
                selected={selected}
                onToggle={handleToggle}
                closeSignal={closeSignal}
              />
            )}

            {grouped.nature.length > 0 && (
              <PoiGroup
                label="Natureza"
                items={grouped.nature}
                selected={selected}
                onToggle={handleToggle}
                closeSignal={closeSignal}
              />
            )}

            {grouped.commercial.length > 0 && (
              <PoiGroup
                label="Comercial"
                items={grouped.commercial}
                selected={selected}
                onToggle={handleToggle}
                closeSignal={closeSignal}
              />
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              pill
              className="btn-clear poi-filters-mobile__clear"
              onClick={handleClear}
            >
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}