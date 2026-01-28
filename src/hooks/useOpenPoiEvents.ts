import { useEffect, useRef } from "react";
import { fetchPoiById } from "@/lib/api";

export function useOpenPoiEvents(openPoiFromDto: (dto: any) => Promise<void>) {
    const busyRef = useRef(0);

    useEffect(() => {
        const handler = async (e: Event) => {
            const ce = e as CustomEvent<{ poiId: number }>;
            const poiId = ce?.detail?.poiId;
            if (!poiId) return;

            const req = ++busyRef.current;
            try {
                const dto = await fetchPoiById(poiId);
                if (!dto) return;
                if (req !== busyRef.current) return;
                await openPoiFromDto(dto);
            } catch (err) {
                console.error("[pt:open-poi] failed", err);
            }
        };

        window.addEventListener("pt:open-poi", handler as any);
        return () => window.removeEventListener("pt:open-poi", handler as any);
    }, [openPoiFromDto]);
}