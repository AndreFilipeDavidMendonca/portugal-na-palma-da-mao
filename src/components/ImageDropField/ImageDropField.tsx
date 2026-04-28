import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ImageDropField.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";
import { uploadMediaToCloud } from "@/lib/mediaCloud";
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  appendNameToUrl,
  fileToDataUrl,
  getMediaAcceptAttr,
  getMediaExtensionsLabel,
  getMediaFieldLabel,
  isImageUrl,
  isVideoUrl,
  matchesMediaMode,
  prettyMediaName,
  type MediaMode,
} from "@/utils/fileMedia";

type Store = "objectUrl" | "dataUrl" | "cloud";

type Props = {
  label?: string;
  images?: string[];
  onChange: (items: string[]) => void;
  onFilesChange?: (files: File[]) => void;
  mode?: MediaMode;
  maxItems?: number;
  store?: Store;
  onUploadingChange?: (v: boolean) => void;
  cloudEntityType?: "POI" | "DISTRICT" | string;
  cloudEntityId?: number | null;
  cloudMediaType?: "IMAGE" | "VIDEO" | "FILE" | string;
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

function cleanMediaUrl(value: string) {
  return value.split("#")[0];
}

function isSupportedMediaFile(file: File) {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();

  const isImage =
    type.startsWith("image/") ||
    IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));

  const isVideo =
    type.startsWith("video/") ||
    VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));

  return isImage || isVideo;
}

export default function ImageDropField({
  label = "Imagens / vídeos",
  images = [],
  onChange,
  onFilesChange,
  mode = "image",
  maxItems,
  store = "objectUrl",
  onUploadingChange,
  cloudEntityType,
  cloudEntityId,
  cloudMediaType,
}: Props) {
  const [hovering, setHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  useEffect(() => {
    if (images.length === 0) {
      setSelectedIndex(0);
      setSelectedFiles([]);
      onFilesChange?.([]);
      return;
    }

    if (selectedIndex > images.length - 1) {
      setSelectedIndex(images.length - 1);
    }
  }, [images.length, selectedIndex, onFilesChange]);

  useEffect(() => {
    return () => {
      images.forEach((item) => {
        const clean = cleanMediaUrl(item);
        if (clean.startsWith("blob:")) {
          URL.revokeObjectURL(clean);
        }
      });
    };
  }, []);

  const acceptAttr = getMediaAcceptAttr(mode);
  const labelText = getMediaFieldLabel(label, mode);
  const extsLabel = getMediaExtensionsLabel(mode);

  const selectedItem = useMemo(() => {
    if (!images.length) return null;
    return images[selectedIndex] ?? images[0] ?? null;
  }, [images, selectedIndex]);

  const selectedSrc = selectedItem ? cleanMediaUrl(selectedItem) : null;
  const selectedName = selectedItem ? prettyMediaName(selectedItem) : null;
  const selectedIsVideo = selectedItem ? isVideoUrl(selectedItem) : false;
  const selectedIsImage = selectedItem ? isImageUrl(selectedItem) : false;

  const onOpenPicker = () => fileInputRef.current?.click();

  const emitFiles = useCallback(
    (files: File[]) => {
      setSelectedFiles(files);
      onFilesChange?.(files);
    },
    [onFilesChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const all = Array.from(files);
      const heicRejected = all.filter(isHeicFile);
      const withoutHeic = all.filter((file) => !isHeicFile(file));

      const supported = withoutHeic.filter(isSupportedMediaFile);
      const filtered = supported.filter((file) => matchesMediaMode(file, mode));
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

      const limit = typeof maxItems === "number" && maxItems > 0 ? maxItems : undefined;

      if (limit && images.length >= limit) {
        toast.info("Já atingiu o limite de ficheiros.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      setUploading(true);

      try {
        const nextItems = [...images];
        const nextFiles = [...selectedFiles];
        let added = 0;

        for (const file of filtered) {
          if (limit && nextItems.length >= limit) break;

          if (store === "cloud") {
            if (!cloudEntityType || !cloudEntityId) {
              throw new Error("Upload cloud indisponível: entidade não identificada.");
            }

            const uploaded = await uploadMediaToCloud(file, {
              entityType: cloudEntityType,
              entityId: cloudEntityId,
              mediaType:
                cloudMediaType ||
                (file.type.startsWith("video/") ? "VIDEO" : "IMAGE"),
            });

            const urlWithName = appendNameToUrl(uploaded.url, file.name);

            if (!nextItems.includes(urlWithName)) {
              nextItems.push(urlWithName);
              nextFiles.push(file);
              added += 1;
            }
          } else if (store === "dataUrl") {
            const dataUrl = await fileToDataUrl(file);
            const urlWithName = appendNameToUrl(dataUrl, file.name);

            if (!nextItems.includes(urlWithName)) {
              nextItems.push(urlWithName);
              nextFiles.push(file);
              added += 1;
            }
          } else {
            const objUrl = URL.createObjectURL(file);
            const urlWithName = appendNameToUrl(objUrl, file.name);

            if (!nextItems.includes(urlWithName)) {
              nextItems.push(urlWithName);
              nextFiles.push(file);
              added += 1;
            } else {
              URL.revokeObjectURL(objUrl);
            }
          }
        }

        onChange(nextItems);
        emitFiles(nextFiles);

        if (added > 0) {
          toast.success(`${added} ficheiro(s) adicionado(s).`);
          if (images.length === 0) setSelectedIndex(0);
        } else {
          toast.info("Nenhum ficheiro novo foi adicionado.");
        }

        if (limit && nextItems.length >= limit && filtered.length > added) {
          toast.info("Já atingiu o limite de ficheiros.");
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [
      images,
      selectedFiles,
      onChange,
      emitFiles,
      mode,
      maxItems,
      store,
      cloudEntityType,
      cloudEntityId,
      cloudMediaType,
    ]
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
    const clean = url ? cleanMediaUrl(url) : "";

    if (clean.startsWith("blob:")) {
      URL.revokeObjectURL(clean);
    }

    const nextItems = images.filter((_, i) => i !== index);
    const nextFiles = selectedFiles.filter((_, i) => i !== index);

    onChange(nextItems);
    emitFiles(nextFiles);

    if (nextItems.length === 0) {
      setSelectedIndex(0);
    } else if (index < selectedIndex) {
      setSelectedIndex(selectedIndex - 1);
    } else if (index === selectedIndex) {
      setSelectedIndex(Math.min(selectedIndex, nextItems.length - 1));
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
            {selectedItem && selectedSrc && (
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
                    src={selectedSrc}
                    controls
                    playsInline
                  />
                ) : selectedIsImage ? (
                  <img
                    className="imgdrop__preview-media"
                    src={selectedSrc}
                    alt={selectedName ?? "Pré-visualização"}
                  />
                ) : (
                  <a
                    className="imgdrop__preview-file"
                    href={selectedSrc}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📎 {selectedName ?? "Abrir ficheiro"}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="imgdrop__thumbs gold-scroll" role="list" aria-label="Lista de ficheiros">
            {images.map((item, index) => {
              const cleanSrc = cleanMediaUrl(item);
              const isActive = index === selectedIndex;
              const isVideo = isVideoUrl(item);
              const isImage = isImageUrl(item);
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
                    <video className="imgdrop__thumb-media" src={cleanSrc} muted playsInline />
                  ) : isImage ? (
                    <img className="imgdrop__thumb-media" src={cleanSrc} alt={name} />
                  ) : (
                    <span className="imgdrop__thumb-file">📎</span>
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