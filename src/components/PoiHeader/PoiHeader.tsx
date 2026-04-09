import React from "react";
import "./PoiHeader.scss";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";

type Props = {
  title: string;
  titleInput: string;
  setTitleInput: (value: string) => void;

  editing: boolean;
  canEdit: boolean;
  saving: boolean;

  actionMenu?: React.ReactNode;

  onSave: () => void;
  onClose: () => void;
};

export default function PoiHeader({
  title,
  titleInput,
  setTitleInput,
  editing,
  canEdit,
  saving,
  actionMenu,
  onSave,
  onClose,
}: Props) {
  const showInlineEditor = editing && canEdit;
  const showSaveButton = editing && canEdit;
  const showActionMenu = !editing && Boolean(actionMenu);
  const showCloseButton = !editing;

  return (
    <header className={`poi-header ${editing ? "is-editing" : ""}`}>
      <div className="poi-title-wrap">
        <h2 className="poi-title">
          {showInlineEditor ? (
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
            </span>
          )}
        </h2>
      </div>

      <div className="poi-actions">
        {showSaveButton && (
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

        {!editing && showActionMenu ? actionMenu : null}

        {showCloseButton && (
          <Button
            className="poi-close poi-btn-icon poi-btn-icon--glyph"
            onClick={onClose}
            aria-label="Fechar"
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