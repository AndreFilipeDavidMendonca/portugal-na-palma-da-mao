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

export default function PoiModal({
                                     open,
                                     onClose,
                                     info,
                                     poi,
                                     onSaved,
                                     isAdmin = false,
                                 }: Props) {
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

    // ✅ evitar gravar imagens do Wikimedia “sem querer”
    const [persistWikiMedia, setPersistWikiMedia] = useState(false);

    /* =====================
       Sync info → local state
    ===================== */

    useEffect(() => {
        setLocalInfo(info);
        setEditing(false);
        setSaving(false);

        // reset do toggle
        setPersistWikiMedia(false);

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
       Derived
    ===================== */

    const title = useMemo(() => localInfo?.label ?? "Ponto de interesse", [localInfo?.label]);

    const mediaUrls = useMemo(() => {
        const base = editing ? imagesList : [localInfo?.image ?? "", ...(localInfo?.images ?? [])];
        return Array.from(new Set(base.filter(Boolean)));
    }, [editing, imagesList, localInfo?.image, localInfo?.images]);

    const wikiTemp = localInfo?.mediaAttribution?.source === "wikimedia";

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

    const handleSave = async () => {
        if (!requireCanEdit()) return;

        const primaryImage = imagesList[0] ?? null;

        setSaving(true);

        try {
            // ✅ se for media temporário do Wikimedia, só gravamos imagens se o user confirmar
            const shouldPersistImages = !wikiTemp || persistWikiMedia;

            const updated = await updatePoi(poiId!, {
                name: titleInput || null,
                namePt: titleInput || null,
                description: descInput || null,

                image: shouldPersistImages ? primaryImage : null,
                images: shouldPersistImages ? (imagesList.length ? imagesList : null) : null,
            });

            setLocalInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        label: updated.namePt ?? updated.name ?? prev.label,
                        description: updated.description ?? prev.description,
                        image: updated.image ?? (shouldPersistImages ? primaryImage : prev.image) ?? null,
                        images: updated.images ?? (shouldPersistImages ? imagesList : prev.images) ?? [],
                        // se gravou, deixa de ser “temporário”
                        mediaAttribution: shouldPersistImages
                            ? { source: "db", note: null }
                            : prev.mediaAttribution,
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

    /* =====================
       Render
    ===================== */

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
                        {/* ✅ aviso claro e discreto */}
                        {wikiTemp && !editing && (
                            <div
                                style={{
                                    margin: "8px 0 10px",
                                    padding: "8px 10px",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    borderRadius: 10,
                                    fontSize: 13,
                                    opacity: 0.9,
                                }}
                            >
                                📷 Fotografias via <b>Wikimedia Commons</b> (temporário). No futuro, as fotos passam a vir
                                sempre da nossa base de dados.
                            </div>
                        )}

                        {/* ✅ se estiver a editar e as fotos são temporárias, pede confirmação para gravar */}
                        {wikiTemp && editing && canEdit && (
                            <label
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "center",
                                    margin: "8px 0 10px",
                                    padding: "8px 10px",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    borderRadius: 10,
                                    fontSize: 13,
                                    opacity: 0.9,
                                    cursor: "pointer",
                                    userSelect: "none",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={persistWikiMedia}
                                    onChange={(e) => setPersistWikiMedia(e.target.checked)}
                                />
                                Guardar estas fotos do <b>Wikimedia</b> neste POI (opcional).
                            </label>
                        )}

                        <PoiMedia
                            title={title}
                            mediaUrls={mediaUrls}
                            editing={editing}
                            canEdit={canEdit}
                            imagesList={imagesList}
                            setImagesList={setImagesList}
                        />
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