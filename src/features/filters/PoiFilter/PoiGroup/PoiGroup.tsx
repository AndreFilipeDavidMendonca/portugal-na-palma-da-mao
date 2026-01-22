import { useState, useRef } from "react";
import PoiDropdown from "@/features/filters/PoiFilter/PoiGroup/PoiDropDown";
import type { PoiCategory } from "@/utils/constants";

type PoiDropdownItem = {
    key: PoiCategory;
    label: string;
    svg: string;
    count: number;
};

type Props = {
    label: string;
    categories: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;   // ou Set<PoiCategory>
    onToggle: (k: PoiCategory) => void;
};

export default function PoiGroup({ label, categories, selected, onToggle }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    return (
        <div className="poi-group" ref={ref}>
            <button className="poi-group-btn" onClick={() => setOpen(o => !o)}>
                {label}
            </button>

            {open && (
                <PoiDropdown
                    anchorRef={ref}
                    items={categories}
                    selected={selected}
                    onToggle={onToggle}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}