// src/pages/poi/PoiModal.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import { useAuth } from "@/auth/AuthContext";
import { updatePoi } from "@/lib/api";
import "./PoiModal.scss";

import usePoiFavorite from "@/hooks/usePoiFavorite";
import usePoiComments from "@/hooks/usePoiComments";

import PoiHeader from "@/components/PoiHeader";
import PoiMedia from "@/components/PoiMedia";
import PoiSide from "@/components/PoiSide";
import PoiComments from "@/components/PoiComments";

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
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [titleInput, setTitleInput] = useState("");
    const [descInput, setDescInput] = useState("");
    const [imagesList, setImagesList] = useState<string[]>([]);

    /* =====================
       Sync info → local state
    ===================== */

    useEffect(() => {
        setLocalInfo(info);
        setEditing(false);
        setSaving(false);
        setErrorMsg(null);

        if (!info) {
            setTitleInput("");
            setDescInput("");
            setImagesList([]);
            return;
        }

        setTitleInput(info.label ?? "");
        setDescInput(info.description ?? "");

        const gal = Array.from(
            new Set([info.image ?? "", ...(info.images ?? [])].filter(Boolean))
        );
        setImagesList(gal);
    }, [info]);

    /* =====================
       Derived
    ===================== */

    const title = useMemo(
        () => localInfo?.label ?? "Ponto de interesse",
        [localInfo?.label]
    );

    const mediaUrls = useMemo(() => {
        const base = editing
            ? imagesList
            : [localInfo?.image ?? "", ...(localInfo?.images ?? [])];

        return Array.from(new Set(base.filter(Boolean)));
    }, [editing, imagesList, localInfo?.image, localInfo?.images]);

    /* =====================
       Hooks
    ===================== */

    const { isFav, favLoading, toggleFavorite } = usePoiFavorite({
        open,
        poiId,
        user,
        onError: setErrorMsg,
    });

    const commentsState = usePoiComments({ open, poiId, user });

    /* =====================
       Guards
    ===================== */

    const requireCanEdit = useCallback(() => {
        if (!poiId) {
            setErrorMsg("Não foi possível identificar o POI.");
            return false;
        }
        if (!canEdit) {
            setErrorMsg("Sem permissões para editar este POI.");
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
        setErrorMsg(null);

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
        } catch (e: any) {
            setErrorMsg(e?.message || "Falha ao guardar alterações.");
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
                        setErrorMsg(null);
                    }}
                    onSave={handleSave}
                    onClose={onClose}
                />

                <div className="poi-body">
                    <div className="poi-left gold-scroll">
                        <section className="poi-media">
                            <PoiMedia
                                title={title}
                                mediaUrls={mediaUrls}
                                editing={editing}
                                canEdit={canEdit}
                                imagesList={imagesList}
                                setImagesList={setImagesList}
                            />
                        </section>

                        <section className="poi-comments-wrap">
                            <PoiComments {...commentsState} />
                        </section>
                    </div>

                    <aside className="poi-side gold-scroll">
                        <PoiSide
                            coords={localInfo?.coords}
                            editing={editing}
                            canEdit={canEdit}
                            descInput={descInput}
                            setDescInput={setDescInput}
                            description={localInfo?.description ?? ""}
                            errorMsg={errorMsg}
                        />
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
}