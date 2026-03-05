import { useEffect, useRef } from "react";
import type { PoiCategory } from "@/utils/constants";
import type { PoiDropdownItem } from "../PoiFilter";
import Chip from "@/components/Chip/Chip";

type Props = {
  items: PoiDropdownItem[];
  selected: ReadonlySet<PoiCategory>;
  onToggle: (key: PoiCategory) => void;
  onClose: () => void;
};

export default function PoiDropdown({ items, selected, onToggle, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // fechar ao clicar fora
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
        const active = selected.has(c.key);

        return (
          <Chip
            key={c.key}
            variant="poi"
            pill={false}
            selected={active}
            onClick={() => {
              onToggle(c.key);
              onClose();
            }}
            title={c.label}
          >
            {c.svg && (
              <span
                className="poi-chip__icon"
                style={{ color: c.color }}
                dangerouslySetInnerHTML={{ __html: c.svg }}
              />
            )}

            <span className="poi-chip__label">{c.label}</span>

            <em className="poi-chip__count">{c.count}</em>
          </Chip>
        );
      })}
    </div>
  );
}