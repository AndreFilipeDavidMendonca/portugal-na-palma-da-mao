import { useEffect, useRef, useState } from "react";
import type { PoiCategory } from "@/utils/constants";
import type { PoiDropdownItem } from "../PoiFilter";
import PoiDropdown from "@/features/filters/PoiFilter/components/PoiDropDown";

type Props = {
    label: string;
    items: PoiDropdownItem[];
    selected: ReadonlySet<PoiCategory>;
    onToggle: (k: PoiCategory) => void;
    closeSignal?: number; // quando incrementa, fecha
};

export default function PoiGroup({ label, items, selected, onToggle, closeSignal = 0 }: Props) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closeSignal]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="poi-group" ref={wrapRef}>
            <button
                type="button"
                className={`poi-chip poi-chip--group ${open ? "poi-chip--group-open" : ""}`}
                onClick={() => setOpen((v) => !v)}
            >
                <span className="poi-chip__label">{label}</span>
                <span className="poi-chip__arrow">▾</span>
            </button>

            {open && (
                <PoiDropdown
                    anchorRef={wrapRef}
                    items={items}
                    selected={selected}
                    onToggle={onToggle}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}