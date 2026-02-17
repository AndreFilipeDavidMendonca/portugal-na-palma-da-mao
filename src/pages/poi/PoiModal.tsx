// src/pages/poi/PoiModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import { useAuth } from "@/auth/AuthContext";
import { updatePoi } from "@/lib/api";
import "./PoiModal.scss";

import usePoiFavorite from "@/hooks/usePoiFavorite";
import usePoiComments from "@/hooks/usePoiComments";

import PoiHeader from "@/components/PoiHeader/PoiHeader";
import PoiMedia from "@/components/PoiMedia/PoiMedia";
import PoiSide from "@/components/PoiSide/PoiSide";
import PoiComments from "@/components/PoiComment/PoiComments";

import { toast } from "@/components/Toastr/toast";

// ✅ NOVO: resolver media (BD + Wikimedia temporário)
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

export default function PoiModal({ open, onClose, info, poi, onSaved, isAdmin = false }: Props) {
    const { user } = useAuth();

    /* =====================
       IDs & Permissões
    ===================== */

    const poiId = useMemo<number | null>(() => {
        return typeof poi?.properties?.id === "number" ? poi.properties.id : null;
    }, [poi]);

    const poiOwnerId = useMemo<string | null>(() => {
        const v = poi?.properties?.ownerId;
        return typeof v === "string" && v.trim() ? v.trim() : null;
    }, [poi]);

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

    // ✅ NOVO: loading do Wikimedia para POI (opcional)
    const [loadingMedia, setLoadingMedia] = useState(false);

    /* =====================
       Sync info → local state
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

        const gal = Array.from(new Set([info.image ?? "", ...(info.images ?? [])].filter(Boolean)));
        setImagesList(gal);
    }, [info]);

    /* =====================
       Enriquecer imagens via Wikimedia (TEMP)
       - Só quando abre
       - Só se não houver fotos suficientes na BD
       - Comerciais não chamam (shouldUseWikiImages)
    ===================== */

    useEffect(() => {
        let alive = true;
        if (!open) return;
        if (!localInfo?.label?.trim()) return;

        // base vindo da BD/props
        const base = Array.from(new Set([localInfo.image ?? "", ...(localInfo.images ?? [])].filter(Boolean))).slice(0, 10);

        // se já tens fotos suficientes, não faz nada
        if (base.length >= 3) return;

        // se este POI não deve usar wiki (ex: business), não chama
        if (!shouldUseWikiImages(poi)) return;

        (async () => {
            setLoadingMedia(true);
            try {
                // TODO: quando os POIs tiverem sempre fotos na BD,
                // desativar o Wikimedia (WIKI_MEDIA_ENABLED=false) e remover este enrich.
                const merged = await resolvePoiMedia10({
                    label: localInfo.label!,
                    baseImage: localInfo.image ?? null,
                    baseImages: localInfo.images ?? [],
                    allowWikiFor: poi,
                    limit: 10,
                });

                if (!alive) return;

                const primary = merged[0] ?? null;

                setLocalInfo((prev) =>
                    prev
                        ? {
                            ...prev,
                            image: primary ?? prev.image ?? null,
                            images: merged,
                        }
                        : prev
                );

                // se não estás a editar, também atualiza o "draft" da lista
                setImagesList((prev) => {
                    if (editing) return prev;
                    return merged;
                });
            } catch {
                // silencioso: fica com base
            } finally {
                if (alive) setLoadingMedia(false);
            }
        })();

        return () => {
            alive = false;
        };
        // importante: depende do open + label + poiId (para mudar quando muda POI)
    }, [open, poiId, localInfo?.label, localInfo?.image, localInfo?.images, poi, editing]);

    /* =====================
       Derived
    ===================== */

    const title = useMemo(() => localInfo?.label ?? "Ponto de interesse", [localInfo?.label]);

    const mediaUrls = useMemo(() => {
        const base = editing ? imagesList : [localInfo?.image ?? "", ...(localInfo?.images ?? [])];
        return Array.from(new Set(base.filter(Boolean)));
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

    const handleSave = async () => {
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
    };

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
                            imagesList={imagesList}
                            setImagesList={setImagesList}
                        />
                        {/* opcional: um hint quando está a ir buscar */}
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