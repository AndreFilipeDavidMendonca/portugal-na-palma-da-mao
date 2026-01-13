import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import ImageDropField from "@/components/ImageDropField";
import MediaSlideshow from "@/components/MediaSlideshow";
import { updatePoi } from "@/lib/api";
import "./PoiModal.scss";

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
    const [localInfo, setLocalInfo] = useState<PoiInfo | null>(info);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [titleInput, setTitleInput] = useState("");
    const [descInput, setDescInput] = useState("");
    const [imagesList, setImagesList] = useState<string[]>([]);

    useEffect(() => {
        setLocalInfo(info);
        setEditing(false);
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

    const title = useMemo(() => localInfo?.label ?? "Ponto de interesse", [localInfo?.label]);

    const mediaUrls = useMemo(() => {
        return Array.from(new Set([localInfo?.image ?? "", ...(localInfo?.images ?? [])].filter(Boolean)));
    }, [localInfo?.image, localInfo?.images]);

    const poiId: number | null = useMemo(() => {
        return typeof poi?.properties?.id === "number" ? poi.properties.id : null;
    }, [poi]);

    const canRender = open && !!info && !!localInfo;
    const canEdit = Boolean(isAdmin && poiId);

    const handleSave = async () => {
        if (!poiId) {
            setErrorMsg("Não foi possível identificar o POI (id em falta).");
            return;
        }

        const primaryImage = imagesList[0] ?? null;

        setSaving(true);
        setErrorMsg(null);

        try {
            const updated = await updatePoi(poiId, {
                name: titleInput || null,
                namePt: titleInput || null,
                description: descInput || null,
                image: primaryImage,
                images: imagesList.length > 0 ? imagesList : null,
            });

            setLocalInfo((prev) =>
                prev
                    ? {
                        ...prev,
                        label: (updated.namePt ?? updated.name ?? titleInput) || prev.label,
                        description: updated.description ?? descInput,
                        image: updated.image ?? primaryImage ?? prev.image ?? null,
                        images: updated.images ?? imagesList,
                    }
                    : prev
            );

            setEditing(false);

            onSaved?.({
                id: poiId,
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

    if (!canRender) return null;

    return ReactDOM.createPortal(
        <div className="poi-overlay" onClick={onClose}>
            <div className="poi-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <header className="poi-header">
                    <div className="poi-title-wrap">
                        <h2 className="poi-title">
                            {editing && canEdit ? (
                                <input
                                    className="poi-edit-input"
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    placeholder="Título do ponto de interesse"
                                />
                            ) : (
                                title
                            )}
                        </h2>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {canEdit && (
                            <button
                                className="poi-edit-btn"
                                type="button"
                                onClick={() => {
                                    setEditing((v) => !v);
                                    setErrorMsg(null);
                                }}
                            >
                                {editing ? "Cancelar" : "Editar"}
                            </button>
                        )}

                        {editing && canEdit && (
                            <button className="poi-save-btn" type="button" disabled={saving} onClick={handleSave}>
                                {saving ? "A guardar..." : "Guardar"}
                            </button>
                        )}

                        <button className="poi-close" onClick={onClose} aria-label="Fechar" type="button">
                            ×
                        </button>
                    </div>
                </header>

                <div className="poi-body">
                    <section className="poi-media gold-scroll">
                        <MediaSlideshow items={mediaUrls} title={title} />

                        {editing && canEdit && (
                            <div className="poi-media-uploader">
                                <ImageDropField label="Imagens / vídeos" images={imagesList} onChange={setImagesList} mode="media" />
                            </div>
                        )}
                    </section>

                    <aside className="poi-side gold-scroll">
                        <a
                            className="btn-directions"
                            href={
                                localInfo?.coords
                                    ? `https://www.google.com/maps/dir/?api=1&destination=${localInfo.coords.lat},${localInfo.coords.lon}`
                                    : `https://www.google.com/maps/`
                            }
                            target="_blank"
                            rel="noreferrer"
                        >
                            Direções
                        </a>
                        {errorMsg && <div className="poi-error">{errorMsg}</div>}

                        {editing && canEdit ? (
                            <>
                                <label className="poi-edit-label">Descrição</label>
                                <textarea className="poi-edit-textarea" rows={10} value={descInput} onChange={(e) => setDescInput(e.target.value)} />
                            </>
                        ) : (
                            <p className="poi-desc">{localInfo?.description ?? ""}</p>
                        )}
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
}