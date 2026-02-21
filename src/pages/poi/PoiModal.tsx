import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./PoiModal.scss";

import type { PoiInfo } from "@/lib/poiInfo";
import { useAuth } from "@/auth/AuthContext";
import { updatePoi } from "@/lib/api";
import { toast } from "@/components/Toastr/toast";

import usePoiFavorite from "@/hooks/usePoiFavorite";
import usePoiComments from "@/hooks/usePoiComments";

import PoiHeader from "@/components/PoiHeader/PoiHeader";
import PoiMedia from "@/components/PoiMedia/PoiMedia";
import PoiSide from "@/components/PoiSide/PoiSide";
import PoiComments from "@/components/PoiComment/PoiComments";

import { resolvePoiMedia10, shouldUseWikiImages } from "@/lib/poiMedia";

type Props = {
    open: boolean;
    onClose: () => void;
    info: PoiInfo | null;
    poi?: any;
    onSaved?: (patch: {
        id: number;
        name?: string | null;
        namePt?: string | null;
        description?: string | null;
        image?: string | null;
        images?: string[] | null;
    }) => void;
    isAdmin?: boolean;
};

function uniqStrings(arr: string[]) {
    return Array.from(new Set((arr ?? []).filter(Boolean)));
}

function isBlobUrl(u: string) {
    return typeof u === "string" && u.startsWith("blob:");
}

function sanitizePersistableMedia(list: string[]) {
    // ✅ só permitimos URLs persistentes: http(s) e data:
    return (list ?? []).filter((u) => {
        if (!u) return false;
        if (u.startsWith("data:")) return true;
        if (u.startsWith("http://") || u.startsWith("https://")) return true;
        return false;
    });
}

function pickPoiId(poi: any): number | null {
    const id = poi?.properties?.id;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
}

function pickOwnerId(poi: any): string | null {
    const v = poi?.properties?.ownerId;
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default function PoiModal({ open, onClose, info, poi, onSaved, isAdmin = false }: Props) {
    const { user } = useAuth();

    const poiId = useMemo(() => pickPoiId(poi), [poi]);
    const poiOwnerId = useMemo(() => pickOwnerId(poi), [poi]);

    const isOwner = useMemo(() => {
        if (!user?.id || !poiOwnerId) return false;
        return String(user.id) === String(poiOwnerId);
    }, [user?.id, poiOwnerId]);

    const canEdit = Boolean(poiId && (isAdmin || isOwner));
    const canRender = open && !!info;

    /* =====================
       Local state
    ===================== */
    const [localInfo, setLocalInfo] = useState<PoiInfo | null>(info);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [titleInput, setTitleInput] = useState("");
    const [descInput, setDescInput] = useState("");
    const [imagesList, setImagesList] = useState<string[]>([]);

    const [loadingMedia, setLoadingMedia] = useState(false);

    /* =====================
       Sync info → local
       (BD-first)
    ===================== */
    useEffect(() => {
        setLocalInfo(info);
        setEditing(false);
        setSaving(false);
        setLoadingMedia(false);

        if (!info) {
            setTitleInput("");
            setDescInput("");
            setImagesList([]);
            return;
        }

        setTitleInput(info.label ?? "");
        setDescInput(info.description ?? "");

        // ✅ BD-first: só coisas persistentes (nada de blob)
        const dbBase = sanitizePersistableMedia(
            uniqStrings([info.image ?? "", ...(info.images ?? [])])
        ).slice(0, 10);

        setImagesList(dbBase);
    }, [info]);

    /* =====================
       Wikimedia enrich (1x por POI)
       - só quando abre
       - só se precisa
       - BD-first, wiki-fill
       - NÃO mexe no draft se estiveres a editar
    ===================== */
    const wikiTried = useRef<Set<number>>(new Set());
    const wikiInflight = useRef<Set<number>>(new Set());

    useEffect(() => {
        let alive = true;

        if (!open) return;
        if (!poiId) return;

        const label = localInfo?.label?.trim();
        if (!label) return;

        if (!shouldUseWikiImages(poi)) return;
        if (wikiTried.current.has(poiId)) return;
        if (wikiInflight.current.has(poiId)) return;

        // ✅ base do BE (persistente)
        const baseFromBe = sanitizePersistableMedia(
            uniqStrings([localInfo?.image ?? "", ...(localInfo?.images ?? [])])
        ).slice(0, 10);

        // se já tens suficiente, não chama
        if (baseFromBe.length >= 3) {
            wikiTried.current.add(poiId);
            return;
        }

        wikiInflight.current.add(poiId);

        (async () => {
            setLoadingMedia(true);
            try {
                // resolvePoiMedia10 já sabe ir buscar wiki,
                // mas nós garantimos BD-first ao reconstruir o merge final.
                const merged = await resolvePoiMedia10({
                    label,
                    baseImage: baseFromBe[0] ?? null,
                    baseImages: baseFromBe,
                    allowWikiFor: poi,
                    limit: 10,
                });

                if (!alive) return;

                wikiTried.current.add(poiId);

                const wikiOnly = sanitizePersistableMedia(uniqStrings(merged ?? []));

                // ✅ BD-first then wiki-fill
                const finalList = uniqStrings([...baseFromBe, ...wikiOnly]).slice(0, 10);
                if (finalList.length === 0) return;

                const primary = finalList[0] ?? null;

                setLocalInfo((prev) =>
                    prev ? { ...prev, image: primary ?? prev.image ?? null, images: finalList } : prev
                );

                // só atualiza o draft se não estás a editar
                setImagesList((prev) => (editing ? prev : finalList));
            } catch {
                wikiTried.current.add(poiId);
            } finally {
                wikiInflight.current.delete(poiId);
                if (alive) setLoadingMedia(false);
            }
        })();

        return () => {
            alive = false;
        };
        // ✅ deps minimizadas (sem image/images para não virar loop)
    }, [open, poiId, localInfo?.label, poi, editing]);

    /* =====================
       Derived
    ===================== */
    const title = useMemo(() => localInfo?.label ?? "Ponto de interesse", [localInfo?.label]);

    const mediaUrls = useMemo(() => {
        if (editing) {
            // Em edição mostramos o draft (pode ter data:)
            return uniqStrings(imagesList ?? []);
        }

        // Fora: BD-first, sem blob
        const base = sanitizePersistableMedia(
            uniqStrings([localInfo?.image ?? "", ...(localInfo?.images ?? [])])
        );

        return base;
    }, [editing, imagesList, localInfo?.image, localInfo?.images]);

    /* =====================
       Hooks
    ===================== */
    const { isFav, favLoading, toggleFavorite } = usePoiFavorite({ open, poiId, user });
    const commentsState = usePoiComments({ open, poiId, user });

    /* =====================
       Guards
    ===================== */
    const requireCanEdit = useCallback(() => {
        if (!poiId) {
            toast.error("Não foi possível identificar o POI.");
            return false;
        }
        if (!canEdit) {
            toast.error("Sem permissões para editar este POI.");
            return false;
        }
        return true;
    }, [poiId, canEdit]);

    /* =====================
       Save
    ===================== */
    const handleSave = useCallback(async () => {
        if (!requireCanEdit()) return;

        // ✅ Nunca enviar blobs para o BE
        const persistable = sanitizePersistableMedia(imagesList ?? []).slice(0, 10);
        const primaryImage = persistable[0] ?? null;

        setSaving(true);
        try {
            const updated = await updatePoi(poiId!, {
                name: titleInput || null,
                namePt: titleInput || null,
                description: descInput || null,
                image: primaryImage,
                images: persistable.length ? persistable : null,
            });

            // Atualiza UI imediata
            const updatedList = sanitizePersistableMedia(
                uniqStrings([updated.image ?? "", ...(updated.images ?? [])])
            ).slice(0, 10);

            setLocalInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        label: updated.namePt ?? updated.name ?? prev.label,
                        description: updated.description ?? prev.description,
                        image: updated.image ?? updatedList[0] ?? prev.image ?? null,
                        images: updated.images ?? updatedList,
                    }
                    : prev
            );

            // mantém draft coerente com o BE
            setImagesList(updatedList);

            setEditing(false);

            onSaved?.({
                id: poiId!,
                name: updated.name,
                namePt: updated.namePt,
                description: updated.description,
                image: updated.image,
                images: updated.images,
            });

            toast.success("Alterações guardadas.");
        } catch (e: any) {
            toast.error(e?.message || "Falha ao guardar alterações.");
        } finally {
            setSaving(false);
        }
    }, [requireCanEdit, poiId, titleInput, descInput, imagesList, onSaved]);

    if (!canRender || !localInfo) return null;

    return ReactDOM.createPortal(
        <div className="poi-overlay" onClick={onClose}>
            <div className="poi-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <PoiHeader
                    title={title}
                    titleInput={titleInput}
                    setTitleInput={setTitleInput}
                    editing={editing}
                    canEdit={canEdit}
                    saving={saving}
                    isFav={isFav}
                    favLoading={favLoading}
                    user={user}
                    onToggleFavorite={(e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite();
                    }}
                    onToggleEdit={() => {
                        if (!requireCanEdit()) return;
                        setEditing((v) => !v);
                    }}
                    onSave={handleSave}
                    onClose={onClose}
                />

                <div className="poi-body">
                    <section className="poi-media" aria-label="Galeria">
                        <PoiMedia
                            title={title}
                            mediaUrls={mediaUrls}
                            editing={editing}
                            canEdit={canEdit}
                            imagesList={imagesList ?? []}
                            setImagesList={setImagesList}
                        />
                        {!editing && loadingMedia && (
                            <div className="poi-media__hint">A carregar fotos (Wikimedia)…</div>
                        )}
                    </section>

                    <aside className="poi-side" aria-label="Detalhes">
                        <PoiSide
                            coords={localInfo?.coords}
                            editing={editing}
                            canEdit={canEdit}
                            descInput={descInput}
                            setDescInput={setDescInput}
                            description={localInfo?.description ?? ""}
                        />
                    </aside>

                    <section className="poi-comments-wrap" aria-label="Comentários">
                        <PoiComments {...commentsState} />
                    </section>
                </div>
            </div>
        </div>,
        document.body
    );
}