import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ImageDropField.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";
import {
  appendNameToUrl,
  fileToDataUrl,
  getMediaAcceptAttr,
  getMediaExtensionsLabel,
  getMediaFieldLabel,
  isVideoUrl,
  matchesMediaMode,
  prettyMediaName,
  type MediaMode,
} from "@/utils/fileMedia";

type Store = "objectUrl" | "dataUrl";

type Props = {
  label?: string;
  images?: string[];
  onChange: (items: string[]) => void;
  mode?: MediaMode;
  maxItems?: number;
  store?: Store;
  onUploadingChange?: (v: boolean) => void;
};

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export default function ImageDropField({
  label = "Imagens / vídeos",
  images = [],
  onChange,
  mode = "image",
  maxItems,
  store = "objectUrl",
  onUploadingChange,
}: Props) {
  const [hovering, setHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  useEffect(() => {
    if (images.length === 0) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > images.length - 1) {
      setSelectedIndex(images.length - 1);
    }
  }, [images, selectedIndex]);

  const acceptAttr = getMediaAcceptAttr(mode);
  const labelText = getMediaFieldLabel(label, mode);
  const extsLabel = getMediaExtensionsLabel(mode);

  const selectedItem = useMemo(() => {
    if (!images.length) return null;
    return images[selectedIndex] ?? images[0] ?? null;
  }, [images, selectedIndex]);

  const selectedName = selectedItem ? prettyMediaName(selectedItem) : null;
  const selectedIsVideo = selectedItem ? isVideoUrl(selectedItem) : false;

  const onOpenPicker = () => fileInputRef.current?.click();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const all = Array.from(files);
      const heicRejected = all.filter(isHeicFile);
      const withoutHeic = all.filter((file) => !isHeicFile(file));
      const filtered = withoutHeic.filter((file) => matchesMediaMode(file, mode));
      const rejectedCount = all.length - filtered.length;

      if (heicRejected.length > 0) {
        toast.error("Ficheiros HEIC/HEIF não são suportados. Usa JPG, PNG ou WEBP.");
      }

      if (filtered.length === 0) {
        toast.error("Nenhum ficheiro compatível foi selecionado.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (rejectedCount > 0) {
        toast.info(`${rejectedCount} ficheiro(s) ignorado(s) por formato.`);
      }

      const currentCount = images.length;
      const limit = typeof maxItems === "number" && maxItems > 0 ? maxItems : undefined;

      if (limit && currentCount >= limit) {
        toast.info("Já atingiu o limite de ficheiros.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploading(true);

      try {
        const next = [...images];
        let added = 0;

        for (const file of filtered) {
          if (limit && next.length >= limit) break;

          if (store === "dataUrl") {
            const dataUrl = await fileToDataUrl(file);
            const urlWithName = appendNameToUrl(dataUrl, file.name);

            if (!next.includes(urlWithName)) {
              next.push(urlWithName);
              added += 1;
            }
          } else {
            const objUrl = URL.createObjectURL(file);
            const urlWithName = appendNameToUrl(objUrl, file.name);

            if (!next.includes(urlWithName)) {
              next.push(urlWithName);
              added += 1;
            } else {
              URL.revokeObjectURL(objUrl);
            }
          }
        }

        onChange(next);

        if (added > 0) {
          toast.success(`${added} ficheiro(s) adicionado(s).`);
          if (images.length === 0) setSelectedIndex(0);
        } else {
          toast.info("Nenhum ficheiro novo foi adicionado.");
        }

        if (limit && next.length >= limit && filtered.length > added) {
          toast.info("Já atingiu o limite de ficheiros.");
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [images, onChange, mode, maxItems, store]
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHovering(false);
    void handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHovering(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setHovering(false);
  };

  const removeItem = (index: number) => {
    if (!images.length) return;

    const url = images[index];
    const base = url?.split("#")[0];

    if (base?.startsWith("blob:")) {
      URL.revokeObjectURL(base);
    }

    const next = images.filter((_, i) => i !== index);
    onChange(next);

    if (next.length === 0) {
      setSelectedIndex(0);
    } else if (index < selectedIndex) {
      setSelectedIndex(selectedIndex - 1);
    } else if (index === selectedIndex) {
      setSelectedIndex(Math.min(selectedIndex, next.length - 1));
    }

    toast.info("Item removido.");
  };

  return (
    <div className="imgdrop">
      <label className="imgdrop__label">{labelText}</label>

      <div
        className={
          "imgdrop__zone" +
          (hovering ? " imgdrop__zone--hover" : "") +
          (uploading ? " imgdrop__zone--uploading" : "")
        }
        onClick={onOpenPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div className="imgdrop__content">
          <div className="imgdrop__icon">{uploading ? "⏳" : "⬆️"}</div>

          <div>
            <div className="imgdrop__text">
              {uploading ? "A processar ficheiros…" : "Adicione ficheiros media"}
            </div>
            <div className="imgdrop__hint">Arrasta para aqui ou clica para selecionar</div>
          </div>

          <div className="imgdrop__exts">{extsLabel}</div>
        </div>

        <input
          ref={fileInputRef}
          className="imgdrop__input"
          type="file"
          multiple
          accept={acceptAttr}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {images.length > 0 && (
        <div className="imgdrop__media">
          <div className="imgdrop__preview">
            {selectedItem && (
              <div className="imgdrop__preview-frame">
                <Button
                  type="button"
                  className="imgdrop__preview-remove"
                  onClick={() => removeItem(selectedIndex)}
                  aria-label="Remover item selecionado"
                  title="Remover item selecionado"
                >
                  ×
                </Button>

                {selectedIsVideo ? (
                  <video
                    className="imgdrop__preview-media"
                    src={selectedItem}
                    controls
                    playsInline
                  />
                ) : (
                  <img
                    className="imgdrop__preview-media"
                    src={selectedItem}
                    alt={selectedName ?? "Pré-visualização"}
                  />
                )}
              </div>
            )}
          </div>

          <div className="imgdrop__thumbs gold-scroll" role="list" aria-label="Lista de ficheiros">
            {images.map((item, index) => {
              const isActive = index === selectedIndex;
              const isVideo = isVideoUrl(item);
              const name = prettyMediaName(item);

              return (
                <div
                  key={`${item}-${index}`}
                  className={`imgdrop__thumb ${isActive ? "is-active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedIndex(index);
                    }
                  }}
                  title={name}
                >
                  {isVideo ? (
                    <video className="imgdrop__thumb-media" src={item} muted playsInline />
                  ) : (
                    <img className="imgdrop__thumb-media" src={item} alt={name} />
                  )}

                  <Button
                    type="button"
                    className="imgdrop__thumb-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(index);
                    }}
                    aria-label={`Remover ${name}`}
                    title={`Remover ${name}`}
                  >
                    ×
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}