import { useEffect, useMemo, useRef, useState } from "react";
import { POI_CATEGORIES, type PoiCategory, CATEGORY_COLORS } from "@/utils/constants";
import { POI_ICON_SVG_RAW } from "@/utils/icons";
import { paintPoiIconSvg } from "@/utils/poiSvg";

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
  onAnySelection?: () => void;
};

export type PoiDropdownItem = {
  key: PoiCategory;
  label: string;
  svg?: string | null;
  count: number;
  color: string;
};

const CULTURE_SET = new Set<PoiCategory>(["castle", "palace", "monument", "ruins", "church"]);
const NATURE_SET = new Set<PoiCategory>(["viewpoint", "park", "trail"]);
const COMMERCIAL_SET = new Set<PoiCategory>(["gastronomy", "crafts", "accommodation", "event"]);

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

function buildPaintedIcon(category: PoiCategory) {
  const color = CATEGORY_COLORS[category] || "#777";
  const rawSvg = POI_ICON_SVG_RAW[category] ?? null;
  return {
    color,
    svg: rawSvg ? paintPoiIconSvg(rawSvg, color) : null,
  };
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

    for (const { key, label } of POI_CATEGORIES) {
      const cat = key as PoiCategory;
      const { color, svg } = buildPaintedIcon(cat);

      const item: PoiDropdownItem = {
        key: cat,
        label,
        svg,
        count: countsByCat[cat] ?? 0,
        color,
      };

      if (CULTURE_SET.has(cat)) culture.push(item);
      else if (NATURE_SET.has(cat)) nature.push(item);
      else if (COMMERCIAL_SET.has(cat)) commercial.push(item);
      else other.push(item);
    }

    return { culture, nature, commercial, other };
  }, [countsByCat]);

  const handleClear = () => {
    onClear();
    onAnySelection?.();
    setCloseSignal((n) => n + 1);
  };

  const handleToggle = (category: PoiCategory) => {
    onToggle(category);
    onAnySelection?.();
    setCloseSignal((n) => n + 1);
  };

  if (!isTop) {
    return (
      <div className="poi-filter poi-filter--panel" data-poi-filter="panel" ref={wrapRef}>
        <div className="poi-filter__inner poi-filter__inner--panel">
          {POI_CATEGORIES.map(({ key, label }) => {
            const cat = key as PoiCategory;
            const checked = selected.has(cat);
            const count = countsByCat[cat] ?? 0;
            const { color, svg } = buildPaintedIcon(cat);

            return (
              <Chip
                as="label"
                key={cat}
                variant="poi"
                pill={false}
                selected={checked}
                title={label}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Checkbox checked={checked} onChange={() => handleToggle(cat)} accent={color} />

                {svg && (
                  <span
                    className="poi-chip__icon"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                )}

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

  const navLabel = navMode === "home" ? "Voltar à Home" : "Voltar ao mapa";

  return (
    <div className="poi-filter poi-filter--top" data-poi-filter="top" ref={wrapRef}>
      <div className="poi-filter__inner">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          pill
          className="gold-close gold-close--left"
          onClick={onNav}
          aria-label={navLabel}
          title={navLabel}
        >
          {navMode === "home" ? <HomeIcon /> : <BackIcon />}
        </Button>

        {!!grouped.culture.length && (
          <PoiGroup
            label="Cultura"
            items={grouped.culture}
            selected={selected}
            onToggle={handleToggle}
            closeSignal={closeSignal}
          />
        )}

        {!!grouped.nature.length && (
          <PoiGroup
            label="Natureza"
            items={grouped.nature}
            selected={selected}
            onToggle={handleToggle}
            closeSignal={closeSignal}
          />
        )}

        {!!grouped.commercial.length && (
          <PoiGroup
            label="Comercial"
            items={grouped.commercial}
            selected={selected}
            onToggle={handleToggle}
            closeSignal={closeSignal}
          />
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