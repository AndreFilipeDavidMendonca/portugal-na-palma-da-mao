import React from "react";
import "./PoiHeader.scss";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";

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
  onToggleShare: (e: React.MouseEvent<HTMLButtonElement>) => void;
  shareDisabled?: boolean;
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

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1.02L7.9 7.23a3 3 0 0 0-1.9-.68 3 3 0 1 0 1.9 5.32l4.29 2.21A3.02 3.02 0 0 0 12 15a3 3 0 1 0 .18 1.02L7.9 13.81A3 3 0 0 0 8 13c0-.28-.04-.55-.1-.81l4.28-2.21c.54.64 1.34 1.02 2.22 1.02Z"
        fill="currentColor"
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
  onToggleShare,
  shareDisabled = false,
  onToggleEdit,
  onSave,
  onClose,
}: Props) {
  const favTitle = user
    ? isFav
      ? "Remover dos Favoritos"
      : "Adicionar aos Favoritos"
    : "Adicionar aos Favoritos";

  return (
    <header className={`poi-header ${editing ? "is-editing" : ""}`}>
      <div className="poi-title-wrap">
        <h2 className="poi-title">
          {editing && canEdit ? (
            <Input
              variant="inline"
              size="xs"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Título do ponto de interesse"
              fullWidth={false}
              css={{ width: "90%" }}
            />
          ) : (
            <span className="poi-title-row">
              <span className="poi-title-text" title={title}>
                {title}
              </span>

              <Button
                type="button"
                variant="icon"
                size="sm"
                className={`poi-fav-btn poi-btn-icon ${isFav ? "is-active" : ""}`}
                onClick={onToggleFavorite}
                disabled={favLoading}
                title={favTitle}
                aria-label={favTitle}
              >
                <StarIcon filled={isFav} />
              </Button>

              <Button
                type="button"
                variant="icon"
                size="sm"
                className="poi-share-btn poi-btn-icon"
                onClick={onToggleShare}
                disabled={shareDisabled}
                title="Partilhar com amigo"
                aria-label="Partilhar com amigo"
              >
                <ShareIcon />
              </Button>
            </span>
          )}
        </h2>
      </div>

      <div className="poi-actions">
        {canEdit && (
          <Button
            className="poi-edit-btn poi-btn-icon poi-btn-icon--glyph"
            type="button"
            onClick={onToggleEdit}
            title={editing ? "Cancelar" : "Editar"}
            aria-label={editing ? "Cancelar" : "Editar"}
          >
            {editing ? "×" : "✎"}
          </Button>
        )}

        {editing && canEdit && (
          <Button
            className="poi-save-btn poi-btn-icon poi-btn-icon--gold poi-btn-icon--glyph"
            type="button"
            disabled={saving}
            onClick={onSave}
            title="Guardar"
            aria-label="Guardar"
          >
            {saving ? (
              <span className="poi-btn-dots" aria-hidden="true">
                •••
              </span>
            ) : (
              "✓"
            )}
          </Button>
        )}

        {!editing && (
          <Button
          className="poi-close poi-btn-icon poi-btn-icon--glyph"
          onClick={onClose} aria-label="Fechar"
          type="button"
          title="Fechar"
          >
            ×
          </Button>
        )}
      </div>
    </header>
  );
}