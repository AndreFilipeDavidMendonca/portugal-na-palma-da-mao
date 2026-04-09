import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import "./PoiModal.scss";

import type { PoiInfo } from "@/lib/poiInfo";
import { MAX_POI_MEDIA_ITEMS } from "@/constants/media";
import { mergePoiMedia, pickOwnerId, pickPoiId, sanitizePersistableMedia } from "@/utils/poiFeature";
import { useAuth } from "@/auth/AuthContext";
import { updatePoi } from "@/lib/api";
import SharePoiToFriendModal from "@/components/chat/SharePoiToFriendModal";
import { toast } from "@/components/Toastr/toast";

import usePoiFavorite from "@/hooks/usePoiFavorite";
import usePoiComments from "@/hooks/usePoiComments";

import PoiHeader from "@/components/PoiHeader/PoiHeader";
import PoiMedia from "@/components/PoiMedia/PoiMedia";
import PoiSide from "@/components/PoiSide/PoiSide";
import PoiComments from "@/components/PoiComment/PoiComments";
import ActionDropdown, {
  type ActionDropdownItem,
} from "@/components/ActionDropdown/ActionDropdown";

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

  const poiId = useMemo(() => pickPoiId(poi), [poi]);
  const poiOwnerId = useMemo(() => pickOwnerId(poi), [poi]);

  const isOwner = useMemo(() => {
    if (!user?.id || !poiOwnerId) return false;
    return String(user.id) === String(poiOwnerId);
  }, [user?.id, poiOwnerId]);

  const canEdit = Boolean(poiId && (isAdmin || isOwner));
  const canRender = open && !!info;

  const [localInfo, setLocalInfo] = useState<PoiInfo | null>(info);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [titleInput, setTitleInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [imagesList, setImagesList] = useState<string[]>([]);

  useEffect(() => {
    setLocalInfo(info);
    setEditing(false);
    setSaving(false);
    setShareOpen(false);

    if (!info) {
      setTitleInput("");
      setDescInput("");
      setImagesList([]);
      return;
    }

    setTitleInput(info.label ?? "");
    setDescInput(info.description ?? "");

    const base = sanitizePersistableMedia(
      mergePoiMedia(info.image, info.images, MAX_POI_MEDIA_ITEMS)
    ).slice(0, MAX_POI_MEDIA_ITEMS);

    setImagesList(base);
  }, [info]);

  const title = useMemo(
    () => localInfo?.label ?? "Ponto de interesse",
    [localInfo?.label]
  );

  const mediaUrls = useMemo(() => {
    if (editing) {
      return [...new Set(imagesList ?? [])].slice(0, MAX_POI_MEDIA_ITEMS);
    }

    return sanitizePersistableMedia(
      mergePoiMedia(localInfo?.image, localInfo?.images, MAX_POI_MEDIA_ITEMS)
    ).slice(0, MAX_POI_MEDIA_ITEMS);
  }, [editing, imagesList, localInfo?.image, localInfo?.images]);

  const sharePayload = useMemo(() => {
    if (!poiId) return null;

    return {
      poiId,
      poiName: (localInfo?.label ?? title ?? "Ponto de interesse").trim(),
      poiImage: mediaUrls[0] ?? localInfo?.image ?? null,
    };
  }, [poiId, localInfo?.label, localInfo?.image, mediaUrls, title]);

  const { isFav, favLoading, toggleFavorite } = usePoiFavorite({
    open,
    poiId,
    user,
  });

  const commentsState = usePoiComments({ open, poiId, user });

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

  const handleSave = useCallback(async () => {
    if (!requireCanEdit()) return;

    const persistable = sanitizePersistableMedia(imagesList ?? []).slice(0, MAX_POI_MEDIA_ITEMS);
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

      const updatedList = sanitizePersistableMedia(
        mergePoiMedia(updated.image, updated.images, MAX_POI_MEDIA_ITEMS)
      ).slice(0, MAX_POI_MEDIA_ITEMS);

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

  const actionItems = useMemo<ActionDropdownItem[]>(() => {
    const items: ActionDropdownItem[] = [
      {
        key: "favorite",
        label: isFav ? "Remover dos favoritos" : "Guardar nos favoritos",
        onClick: () => {
          if (!user) {
            toast.error("Precisas de iniciar sessão para guardar favoritos.");
            return;
          }
          toggleFavorite();
        },
        disabled: favLoading,
      },
      {
        key: "share",
        label: "Partilhar com amigos",
        onClick: () => {
          if (!user) {
            toast.error("Precisas de iniciar sessão para partilhar POIs.");
            return;
          }
          if (!sharePayload) {
            toast.error("Não foi possível preparar este POI para partilha.");
            return;
          }
          setShareOpen(true);
        },
        disabled: !user || !sharePayload,
      },
      {
        key: "edit",
        label: editing ? "Cancelar edição" : "Editar",
        onClick: () => {
          if (!requireCanEdit()) return;
          setEditing((v) => !v);
        },
        hidden: !canEdit,
      },
    ];

    return items;
  }, [
    isFav,
    user,
    toggleFavorite,
    favLoading,
    sharePayload,
    canEdit,
    editing,
    requireCanEdit,
  ]);

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
              actionMenu={
                <ActionDropdown
                  items={actionItems}
                  ariaLabel="Ações do ponto"
                  title="Ações"
                />
              }
              onSave={handleSave}
              onClose={onClose}
            />

      <div className={`poi-body ${editing ? "is-editing" : ""}`}>
        <section
          className={`poi-media ${editing ? "is-editing" : ""}`}
          aria-label="Galeria"
        >
          <div className={`poi-media__viewport ${editing ? "is-editing" : ""}`}>
            <PoiMedia
              title={title}
              mediaUrls={mediaUrls}
              editing={editing}
              canEdit={canEdit}
              imagesList={imagesList ?? []}
              setImagesList={setImagesList}
            />
          </div>
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

    {sharePayload && (
      <SharePoiToFriendModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        poi={sharePayload}
      />
    )}
  </div>,
  document.body
);
}