// src/pages/poi/PoiModal.tsx
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

const uniqStrings = (arr: string[]) =>
    Array.from(new Set((arr ?? []).filter(Boolean)));

function pickPoiId(poi: any): number | null {
    const id = poi?.properties?.id;
    return typeof id === "number" && Number.isFinite(id) ? id : null;
}

function pickOwnerId(poi: any): string | null {
    const v = poi?.properties?.ownerId;
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default function PoiModal({
                                     open,
                                     onClose,
                                     info,
                                     poi,
                                     onSaved,
                                     isAdmin = false,
                                 }: Props) {
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

        const gal = uniqStrings([info.image ?? "", ...(info.images ?? [])]).slice(
            0,
            10
        );
        setImagesList(gal);
    }, [info]);

    /* =====================
       Wikimedia enrich (1x por POI)
       - só quando abre
       - só se precisa (poucas fotos)
       - não mexe no draft se estiveres a editar
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

        const base = uniqStrings([localInfo?.image ?? "", ...(localInfo?.images ?? [])]).slice(
            0,
            10
        );

        // já tem “suficiente”
        if (base.length >= 3) {
            wikiTried.current.add(poiId);
            return;
        }

        wikiInflight.current.add(poiId);

        (async () => {
            setLoadingMedia(true);
            try {
                const merged = await resolvePoiMedia10({
                    label,
                    baseImage: localInfo?.image ?? null,
                    baseImages: localInfo?.images ?? [],
                    allowWikiFor: poi,
                    limit: 10,
                });

                if (!alive) return;

                wikiTried.current.add(poiId);

                if (!merged || merged.length === 0) return;

                const primary = merged[0] ?? null;

                setLocalInfo((prev) =>
                    prev
                        ? { ...prev, image: primary ?? prev.image ?? null, images: merged }
                        : prev
                );

                // só atualiza o draft se não estiveres a editar
                setImagesList((prev) => (editing ? prev : merged));
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
        // ⚠️ Não metas localInfo.image/images aqui, para não virar “loop”
    }, [open, poiId, localInfo?.label, poi, editing, localInfo?.image, localInfo?.images]);

    /* =====================
       Derived
    ===================== */
    const title = useMemo(
        () => localInfo?.label ?? "Ponto de interesse",
        [localInfo?.label]
    );

    const mediaUrls = useMemo(() => {
        // em edição: o draft (imagesList)
        if (editing) return uniqStrings(imagesList);

        // fora: o que estiver em localInfo
        return uniqStrings([localInfo?.image ?? "", ...(localInfo?.images ?? [])]);
    }, [editing, imagesList, localInfo?.image, localInfo?.images]);

    /* =====================
       Hooks
    ===================== */
    const { isFav, favLoading, toggleFavorite } = usePoiFavorite({
        open,
        poiId,
        user,
    });
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

        const primaryImage = imagesList[0] ?? null;

        setSaving(true);
        try {
            const updated = await updatePoi(poiId!, {
                name: titleInput || null,
                namePt: titleInput || null,
                description: descInput || null,
                image: primaryImage,
                images: imagesList.length ? imagesList : null,
            });

            // Atualiza UI imediata
            setLocalInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        label: updated.namePt ?? updated.name ?? prev.label,
                        description: updated.description ?? prev.description,
                        image: updated.image ?? primaryImage ?? prev.image ?? null,
                        images: updated.images ?? imagesList,
                    }
                    : prev
            );

            // ✅ Importantíssimo: manter o draft coerente com a resposta do BE
            // (para não ficar “preso” com blob/draft antigo)
            setImagesList(uniqStrings([updated.image ?? "", ...(updated.images ?? [])]).slice(0, 10));

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
            <div
                className="poi-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
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
                            imagesList={imagesList}
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