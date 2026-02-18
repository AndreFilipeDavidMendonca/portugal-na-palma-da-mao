// src/components/DistrictGalleryPane/DistrictGalleryPane.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./DistrictGalleryPane.scss";

import { resolveDistrictMedia10 } from "@/lib/poiMedia";
import MediaStack from "@/components/MediaStack/MediaStack";

type Props = {
    open: boolean;
    districtName: string;
    baseUrls: string[];
    onClose: () => void;
    setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

function toUrlList(input: any): string[] {
    const arr = Array.isArray(input) ? input : [];
    return arr
        .map((x) => {
            if (typeof x === "string") return x;
            return x?.url || x?.src || x?.image || x?.thumb || "";
        })
        .filter((s: any) => typeof s === "string" && s.trim().length > 0);
}

export default function DistrictGalleryPane({ open, districtName, baseUrls, onClose, setLoading }: Props) {
    const [urls, setUrls] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const base = useMemo(() => uniqStrings(toUrlList(baseUrls)).slice(0, 10), [baseUrls]);

    useEffect(() => {
        let alive = true;
        if (!open) return;

        (async () => {
            setError(null);
            setLoading?.(true);

            try {
                const raw = await resolveDistrictMedia10({
                    name: districtName,
                    baseUrls: base,
                    allowWiki: true,
                    limit: 10,
                });

                if (!alive) return;

                const merged = uniqStrings(toUrlList(raw)).slice(0, 10);
                setUrls(merged);
            } catch (e: any) {
                if (!alive) return;
                setUrls(base);
                setError(e?.message || "Falha ao carregar galeria.");
            } finally {
                if (alive) setLoading?.(false);
            }
        })();

        return () => {
            alive = false;
            setLoading?.(false);
        };
    }, [open, districtName, base, setLoading]);

    if (!open) return null;

    const merged = urls.length ? urls : base;

    return (
        <section className="district-gallery-pane">
            <div className="district-gallery-pane__body">
                {error && <div className="district-gallery-pane__error">{error}</div>}

                {merged.length === 0 ? (
                    <div className="district-gallery-pane__empty">Sem fotos encontradas (ainda).</div>
                ) : (
                    <MediaStack
                        title={districtName}
                        items={merged}
                        frameHeight="clamp(360px, 56vh, 740px)"
                        frameHeightMobile="clamp(260px, 44vh, 560px)"
                        maxWidth="980px"
                    />
                )}
            </div>
        </section>
    );
}