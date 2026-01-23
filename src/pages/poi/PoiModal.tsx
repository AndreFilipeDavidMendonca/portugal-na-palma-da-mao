// src/pages/poi/PoiModal.tsx (ou onde estiver)
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import ImageDropField from "@/components/ImageDropField";
import MediaSlideshow from "@/components/MediaSlideshow";
import { addFavorite, fetchFavoriteStatus, removeFavorite, updatePoi } from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
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

function StarIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
                d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21z"
                fill={filled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
        </svg>
    );
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

    const [localInfo, setLocalInfo] = useState<PoiInfo | null>(info);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [titleInput, setTitleInput] = useState("");
    const [descInput, setDescInput] = useState("");
    const [imagesList, setImagesList] = useState<string[]>([]);

    // favoritos
    const [favLoading, setFavLoading] = useState(false);
    const [isFav, setIsFav] = useState(false);

    const poiId: number | null = useMemo(() => {
        return typeof poi?.properties?.id === "number" ? poi.properties.id : null;
    }, [poi]);

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

        const gal = Array.from(new Set([info.image ?? "", ...(info.images ?? [])].filter(Boolean)));
        setImagesList(gal);
    }, [info]);

    const title = useMemo(() => localInfo?.label ?? "Ponto de interesse", [localInfo?.label]);

    const mediaUrls = useMemo(() => {
        return Array.from(new Set([localInfo?.image ?? "", ...(localInfo?.images ?? [])].filter(Boolean)));
    }, [localInfo?.image, localInfo?.images]);

    const canRender = open && !!info && !!localInfo;
    const canEdit = Boolean(isAdmin && poiId);

    // carrega status de favorito quando abre / muda de POI / muda user
    useEffect(() => {
        let alive = true;

        async function run() {
            if (!open || !poiId) {
                setIsFav(false);
                return;
            }

            // guest: mostra estrela vazia (não rebenta)
            if (!user) {
                setIsFav(false);
                return;
            }

            setFavLoading(true);
            try {
                const fav = await fetchFavoriteStatus(poiId);
                if (!alive) return;

                // ✅ fav é {favorited:boolean} | null
                setIsFav(Boolean(fav?.favorited));
            } catch {
                if (!alive) return;
                setIsFav(false);
            } finally {
                if (alive) setFavLoading(false);
            }
        }

        run();
        return () => {
            alive = false;
        };
    }, [open, poiId, user]);

    const handleToggleFavorite = async () => {
        if (!poiId || favLoading) return;

        setErrorMsg(null);

        // ✅ guest: não adiciona, só avisa
        if (!user) {
            setErrorMsg("Para adicionares aos favoritos, tens de te registar / fazer login.");
            return;
        }

        setFavLoading(true);
        try {
            if (isFav) {
                await removeFavorite(poiId);
                setIsFav(false);
            } else {
                await addFavorite(poiId);
                setIsFav(true);
            }
        } catch (e: any) {
            setErrorMsg(e?.message ?? "Falha ao atualizar favoritos.");
        } finally {
            setFavLoading(false);
        }
    };

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
                                <span className="poi-title-row">
                  <span className="poi-title-text">{title}</span>

                  <button
                      type="button"
                      className={`poi-fav-btn ${isFav ? "is-active" : ""}`}
                      onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleFavorite();
                      }}
                      disabled={favLoading || !poiId}
                      title={user ? (isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos") : "Adicionar aos Favoritos"}
                      aria-label={user ? (isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos") : "Adicionar aos Favoritos"}
                  >
                    <StarIcon filled={isFav} />
                  </button>
                </span>
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
                        <div className="poi-media-slideshow">
                            <MediaSlideshow items={mediaUrls} title={title} />
                        </div>

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
                                <textarea
                                    className="poi-edit-textarea"
                                    rows={10}
                                    value={descInput}
                                    onChange={(e) => setDescInput(e.target.value)}
                                />
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