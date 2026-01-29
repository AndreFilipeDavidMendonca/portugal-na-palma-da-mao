import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import type { PoiCategory } from "@/utils/constants";

type PoiFiltersApi = {
    selected: Set<PoiCategory>;
    has: (k: PoiCategory) => boolean;
    toggle: (k: PoiCategory) => void;
    setSelected: (next: Set<PoiCategory>) => void;
    clear: () => void;
};

const PoiFiltersContext = createContext<PoiFiltersApi | null>(null);

export function PoiFiltersProvider({ children }: { children: React.ReactNode }) {
    const [selected, setSelectedRaw] = useState<Set<PoiCategory>>(() => new Set());

    const setSelected = useCallback((next: Set<PoiCategory>) => {
        // garante nova referência (react render)
        setSelectedRaw(new Set(next));
    }, []);

    const toggle = useCallback((k: PoiCategory) => {
        setSelectedRaw((prev) => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelectedRaw(new Set()), []);

    const value = useMemo<PoiFiltersApi>(() => {
        return {
            selected,
            has: (k) => selected.has(k),
            toggle,
            setSelected,
            clear,
        };
    }, [selected, toggle, setSelected, clear]);

    return <PoiFiltersContext.Provider value={value}>{children}</PoiFiltersContext.Provider>;
}

export function usePoiFilters(): PoiFiltersApi {
    const ctx = useContext(PoiFiltersContext);
    if (!ctx) throw new Error("usePoiFilters must be used within <PoiFiltersProvider />");
    return ctx;
}