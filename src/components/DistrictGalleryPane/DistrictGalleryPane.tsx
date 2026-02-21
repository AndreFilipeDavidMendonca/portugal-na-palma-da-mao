import React, { useEffect, useMemo, useState } from "react";
import "./DistrictGalleryPane.scss";

import { resolveDistrictMedia10 } from "@/lib/poiMedia";
import DistrictMedia from "@/components/DistrictMedia/DistrictMedia";

type Props = {
    open: boolean;
    districtName: string;
    baseUrls: string[];
    onClose: () => void;
    setLoading?: React.Dispatch<React.SetStateAction<boolean>>;

    editing: boolean;
    isAdmin: boolean;

    distMedia: string[];
    setDistMedia: (v: string[]) => void;
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

export default function DistrictGalleryPane({
                                                open,
                                                districtName,
                                                baseUrls,
                                                setLoading,
                                                editing,
                                                isAdmin,
                                                distMedia,
                                                setDistMedia,
                                            }: Props) {
    const [wikiResolved, setWikiResolved] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const isEditing = Boolean(editing && isAdmin);

    // base do "DB" (props)
    const baseFromDb = useMemo(() => {
        return uniqStrings(toUrlList(baseUrls)).slice(0, 10);
    }, [baseUrls]);

    // UI final: distMedia (user) -> wikiResolved -> baseFromDb
    const displayItems = useMemo(() => {
        return uniqStrings([...(distMedia ?? []), ...(wikiResolved ?? []), ...baseFromDb]).slice(0, 10);
    }, [distMedia, wikiResolved, baseFromDb]);

    useEffect(() => {
        let alive = true;
        if (!open) return;

        (async () => {
            setError(null);
            setLoading?.(true);

            try {
                const raw = await resolveDistrictMedia10({
                    name: districtName,
                    baseUrls: baseFromDb,
                    allowWiki: true,
                    limit: 10,
                });

                if (!alive) return;

                const merged = uniqStrings(toUrlList(raw)).slice(0, 10);
                setWikiResolved(merged);
            } catch (e: any) {
                if (!alive) return;
                setWikiResolved([]);
                setError(e?.message || "Falha ao carregar galeria.");
            } finally {
                if (alive) setLoading?.(false);
            }
        })();

        return () => {
            alive = false;
            setLoading?.(false);
        };
    }, [open, districtName, baseFromDb, setLoading]);

    if (!open) return null;

    return (
        <section className={`district-gallery-pane ${isEditing ? "is-editing" : ""}`}>
            <div className="district-gallery-pane__body">
                {error && <div className="district-gallery-pane__error">{error}</div>}

                {displayItems.length === 0 ? (
                    <div className="district-gallery-pane__empty">Sem media encontrado (ainda).</div>
                ) : (
                    <DistrictMedia
                        districtName={districtName}
                        items={displayItems}
                        editing={editing}
                        canEdit={isAdmin}
                        mediaList={distMedia}
                        setMediaList={setDistMedia}
                        maxItems={10}
                    />
                )}
            </div>
        </section>
    );
}