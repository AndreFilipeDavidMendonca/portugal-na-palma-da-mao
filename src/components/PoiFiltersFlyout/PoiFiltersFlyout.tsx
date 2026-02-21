import { useMemo } from "react";
import { POI_LABELS, type PoiCategory } from "@/utils/constants";
import { usePoiFilters } from "@/state/PoiFiltersContext";
import "./PoiFiltersFlyout.scss";
import Button from "@/components/Button/Button";

type Props = {
    open: boolean;
    onClose: () => void;
};

export default function PoiFiltersFlyout({ open, onClose }: Props) {
    const { selected, toggle, clear } = usePoiFilters();

    const allCats = useMemo(() => Object.keys(POI_LABELS) as PoiCategory[], []);

    const activeCount = selected.size;

    if (!open) return null;

    return (
        <div className="user-menu__flyout poi-filters-flyout" role="region" aria-label="Filtros POI">
            <div className="user-menu__flyout-header">
                <span>Filtros POI</span>

                <Button
                    type="button"
                    className="user-menu__flyout-close"
                    onClick={onClose}
                    aria-label="Fechar"
                    title="Fechar"
                >
                    ×
                </Button>
            </div>

            <div className="poi-filters-flyout__meta">
        <span className="poi-filters-flyout__count">
          Ativos: <b>{activeCount}</b>
        </span>

                <Button
                    type="button"
                    className="poi-filters-flyout__clear"
                    onClick={clear}
                    disabled={activeCount === 0}
                    title="Limpar filtros"
                >
                    Limpar
                </Button>
            </div>

            <div className="poi-filters-flyout__list gold-scroll">
                {allCats.map((cat) => {
                    const isOn = selected.has(cat);
                    return (
                        <Button
                            key={cat}
                            type="button"
                            className={`poi-filters-flyout__item ${isOn ? "is-on" : ""}`}
                            onClick={() => toggle(cat)}
                            aria-pressed={isOn}
                            title={POI_LABELS[cat]}
                        >
                            <span className="poi-filters-flyout__label">{POI_LABELS[cat]}</span>
                            <span className="poi-filters-flyout__chip">{isOn ? "ON" : "OFF"}</span>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}