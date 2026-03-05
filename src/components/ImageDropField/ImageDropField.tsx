import React, { useCallback, useRef, useState, useEffect } from "react";
import "./ImageDropField.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";

type Mode = "image" | "video" | "media";
type Store = "objectUrl" | "dataUrl";

type Props = {
  label?: string;
  images?: string[];
  onChange: (items: string[]) => void;
  mode?: Mode;
  maxItems?: number;
  store?: Store;
  onUploadingChange?: (v: boolean) => void; // ✅ novo (para bloquear submit)
};

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".ogg", ".m4v"];

function isVideoUrl(s: string): boolean {
  if (!s) return false;
  if (s.startsWith("data:video/")) return true;
  const base = s.split("#")[0];
  const lower = base.toLowerCase();
  return VIDEO_EXT.some((ext) => lower.endsWith(ext)) || lower.startsWith("blob:");
}

function prettyName(s: string): string {
  try {
    const u = new URL(s);
    if (u.hash && u.hash.startsWith("#name=")) return decodeURIComponent(u.hash.slice("#name=".length));
    const last = u.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(last || s);
  } catch {
    if (s.startsWith("data:")) {
      const idx = s.indexOf("#name=");
      if (idx >= 0) return decodeURIComponent(s.slice(idx + "#name=".length));
      return "ficheiro";
    }
    return s;
  }
}

function appendNameToUrl(url: string, name: string) {
  const safe = encodeURIComponent(name || "ficheiro");
  return `${url}#name=${safe}`;
}

function matchesMode(file: File, mode: Mode) {
  if (mode === "media") return true;

  const type = (file.type || "").toLowerCase();
  if (mode === "image") {
    if (type.startsWith("image/")) return true;
    const n = file.name.toLowerCase();
    return IMAGE_EXT.some((ext) => n.endsWith(ext));
  }

  if (type.startsWith("video/")) return true;
  const n = file.name.toLowerCase();
  return VIDEO_EXT.some((ext) => n.endsWith(ext));
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler ficheiro."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const acceptAttr = mode === "image" ? "image/*" : mode === "video" ? "video/*" : "image/*,video/*";
  const labelText = mode === "image" ? label : mode === "video" ? label.replace(/Imagens/i, "Vídeos") : label;

  const onOpenPicker = () => fileInputRef.current?.click();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const all = Array.from(files);
      const filtered = all.filter((file) => matchesMode(file, mode));
      const rejectedCount = all.length - filtered.length;

      if (filtered.length === 0) {
        toast.error("Nenhum ficheiro compatível foi selecionado.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (rejectedCount > 0) toast.info(`${rejectedCount} ficheiro(s) ignorado(s) por formato.`);

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

            // ✅ mantém nome no hash só para UI (o CreatePoiPage faz strip antes de enviar)
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

        if (added > 0) toast.success(`${added} ficheiro(s) adicionado(s).`);
        else toast.info("Nenhum ficheiro novo foi adicionado.");

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

  const removeItem = (i: number) => {
    if (!images?.length) return;

    const url = images[i];
    const base = url?.split("#")[0];

    if (base?.startsWith("blob:")) URL.revokeObjectURL(base);

    const next = images.slice();
    next.splice(i, 1);
    onChange(next);
    toast.info("Item removido.");
  };

  const extsLabel =
    mode === "image" ? "JPG · PNG · WEBP · GIF" : mode === "video" ? "MP4 · WEBM · MOV · MKV" : "JPG · PNG · MP4 · WEBM · MOV";

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
            <div className="imgdrop__text">{uploading ? "A processar ficheiros…" : "Arrasta ficheiros para aqui"}</div>
            {!uploading && <div className="imgdrop__hint">…ou clica para escolher ficheiros</div>}
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
        <ul className="imgdrop__list gold-scroll">
          {images.map((it, idx) => {
            const name = prettyName(it);
            const isVid = isVideoUrl(it);
            return (
              <li key={idx} className="imgdrop__item">
                <span className="imgdrop__name">
                  {isVid ? "🎬 " : "🖼️ "}
                  {name}
                </span>
                <Button type="button" className="imgdrop__remove" onClick={() => removeItem(idx)}>
                  ×
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}