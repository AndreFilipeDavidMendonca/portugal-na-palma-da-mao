// src/components/DistrictGalleryPane/DistrictGalleryPane.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./DistrictGalleryPane.scss";

import { resolveDistrictMedia10 } from "@/lib/poiMedia";

type Props = {
    open: boolean;
    districtName: string;
    baseUrls: string[];
    onClose: () => void;

    // opcional: o DistrictModal controla o spinner overlay
    setLoading?: React.Dispatch<React.SetStateAction<boolean>>;
};

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

export default function DistrictGalleryPane({
                                                open,
                                                districtName,
                                                baseUrls,
                                                onClose,
                                                setLoading,
                                            }: Props) {
    const [urls, setUrls] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const base = useMemo(() => uniqStrings(baseUrls).slice(0, 10), [baseUrls]);

    useEffect(() => {
        let alive = true;
        if (!open) return;

        (async () => {
            setError(null);
            setLoading?.(true);

            try {
                // TODO: quando os distritos tiverem sempre fotos na BD,
                // desligar o Wikimedia (WIKI_MEDIA_ENABLED=false) e isto fica só com `base`.
                const merged = await resolveDistrictMedia10({
                    name: districtName,
                    baseUrls: base,
                    allowWiki: true,
                    limit: 10,
                });

                if (!alive) return;
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

    return (
        <section className="district-gallery-pane">
            <div className="district-gallery-pane__top">
                <button type="button" className="district-gallery-pane__back" onClick={onClose}>
                    Voltar
                </button>
                <div className="district-gallery-pane__title">{districtName}</div>
            </div>

            {error && <div className="district-gallery-pane__error">{error}</div>}

            {urls.length === 0 ? (
                <div className="district-gallery-pane__empty">Sem fotos encontradas (ainda).</div>
            ) : (
                <div className="district-gallery-pane__grid">
                    {urls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer" className="district-gallery-pane__item">
                            <img src={u} alt={districtName} loading="lazy" />
                        </a>
                    ))}
                </div>
            )}
        </section>
    );
}