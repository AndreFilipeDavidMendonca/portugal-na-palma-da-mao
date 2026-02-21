import { useEffect, useState } from "react";
import type { PoiCategory } from "@/utils/constants";
import type { PoiDropdownItem } from "../PoiFilter";
import PoiDropdown from "@/features/filters/PoiFilter/components/PoiDropDown";
import Chip from "@/components/Chip/Chip";

type Props = {
    label: string;
    items: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    closeSignal?: number;
};

export default function PoiGroup({ label, items, selected, onToggle, closeSignal = 0 }: Props) {
    const [open, setOpen] = useState(false);

    // fecha quando recebe “broadcast”
    useEffect(() => {
        setOpen(false);
    }, [closeSignal]);

    // quando escolho um item do dropdown:
    // 1) aplica toggle
    // 2) fecha este grupo
    const onItemToggle = (k: PoiCategory) => {
        onToggle(k);
        setOpen(false);
    };

    return (
        <div className="poi-group">
            <Chip className={`poi-chip poi-chip--group ${open ? "poi-chip--group-open" : ""}`} onClick={() => setOpen((v) => !v)}>
                <span className="poi-chip__label">{label}</span>
                <span className="poi-chip__arrow">▾</span>
            </Chip>

            {open && (
                <PoiDropdown
                    items={items}
                    selected={selected}
                    onToggle={onItemToggle}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}