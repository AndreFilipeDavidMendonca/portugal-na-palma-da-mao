import { useState, useRef } from "react";
import PoiDropdown from "@/features/filters/PoiFilter/PoiGroup/PoiDropDown";


type Props = {
    label: string;
    categories: { key: string; label: string; svg: string; count: number }[];
    selected: Set<string>;
    onToggle: (k: string) => void;
};

export default function PoiGroup({ label, categories, selected, onToggle }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    return (
        <div
            className="poi-group"
            ref={ref}
        >
            <button
                className="poi-group-btn"
                onClick={() => setOpen(o => !o)}
            >
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