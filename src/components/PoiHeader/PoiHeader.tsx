import React from "react";
import "./PoiHeader.scss";
import Button from "@/components/Button/Button";

type Props = {
    title: string;
    titleInput: string;
    setTitleInput: (v: string) => void;

    editing: boolean;
    canEdit: boolean;
    saving: boolean;

    isFav: boolean;
    favLoading: boolean;
    user: any;

    onToggleFavorite: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onToggleEdit: () => void;
    onSave: () => void;
    onClose: () => void;
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

export default function PoiHeader({
                                      title,
                                      titleInput,
                                      setTitleInput,
                                      editing,
                                      canEdit,
                                      saving,
                                      isFav,
                                      favLoading,
                                      user,
                                      onToggleFavorite,
                                      onToggleEdit,
                                      onSave,
                                      onClose,
                                  }: Props) {
    return (
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

              <Button
                  type="button"
                  className={`poi-fav-btn ${isFav ? "is-active" : ""}`}
                  onClick={onToggleFavorite}
                  disabled={favLoading}
                  title={
                      user ? (isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos") : "Adicionar aos Favoritos"
                  }
                  aria-label={
                      user ? (isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos") : "Adicionar aos Favoritos"
                  }
              >
                <StarIcon filled={isFav} />
              </Button>
            </span>
                    )}
                </h2>
            </div>

            <div className="poi-actions">
                {canEdit && (
                    <Button className="poi-edit-btn" type="button" onClick={onToggleEdit}>
                        {editing ? "Cancelar" : "Editar"}
                    </Button>
                )}

                {editing && canEdit && (
                    <Button className="poi-save-btn" type="button" disabled={saving} onClick={onSave}>
                        {saving ? "A guardar..." : "Guardar"}
                    </Button>
                )}

                <Button className="poi-close" onClick={onClose} aria-label="Fechar" type="button">
                    ×
                </Button>
            </div>
        </header>
    );
}