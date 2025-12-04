// src/components/ImageDropField.tsx
import React, { useCallback, useRef, useState } from "react";
import "./ImageDropField.scss";

type Mode = "image" | "video" | "media";

type Props = {
    label?: string;
    images: string[];                   // URLs (http, data:, blob, etc.)
    onChange: (items: string[]) => void;
    mode?: Mode;                        // "image" | "video" | "media"
};

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".ogg", ".m4v"];

function extListForMode(mode: Mode): string[] {
    if (mode === "image") return IMAGE_EXT;
    if (mode === "video") return VIDEO_EXT;
    return [...IMAGE_EXT, ...VIDEO_EXT];
}

// extrai algo que pareça nome de ficheiro, incluindo hash #name=
function prettyName(s: string): string {
    try {
        const u = new URL(s);
        if (u.hash && u.hash.startsWith("#name=")) {
            return decodeURIComponent(u.hash.slice("#name=".length));
        }
        const last = u.pathname.split("/").filter(Boolean).pop();
        return decodeURIComponent(last || s);
    } catch {
        // se for data:... fica grande, mas pelo menos mostra algo
        if (s.startsWith("data:")) {
            const comma = s.indexOf(",");
            return comma > 0 ? s.slice(5, comma) : "data-url";
        }
        return s;
    }
}

export default function ImageDropField({
   label = "Imagens / vídeos",
   images,
   onChange,
   mode = "image",
}: Props) {
    const [hovering, setHovering] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const acceptAttr =
        mode === "image"
            ? "image/*"
            : mode === "video"
                ? "video/*"
                : "image/*,video/*";

    const labelText =
        mode === "image"
            ? label
            : mode === "video"
                ? label.replace(/Imagens/i, "Vídeos")
                : label;

    const onOpenPicker = () => {
        fileInputRef.current?.click();
    };

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;

            const exts = extListForMode(mode);
            const all = Array.from(files);

            // filtra por extensão
            const filtered = all.filter((file) => {
                const lowerName = file.name.toLowerCase();
                return exts.some((ext) => lowerName.endsWith(ext));
            });

            if (filtered.length === 0) return;

            setUploading(true);

            const next = [...images];
            let pending = filtered.length;

            filtered.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    if (typeof result === "string") {
                        // result é "data:<mime>;base64,...."
                        if (!next.includes(result)) {
                            next.push(result);
                        }
                    }
                    pending -= 1;
                    if (pending === 0) {
                        onChange(next);
                        setUploading(false);
                    }
                };
                reader.onerror = () => {
                    pending -= 1;
                    if (pending === 0) {
                        onChange(next);
                        setUploading(false);
                    }
                };
                reader.readAsDataURL(file);
            });
        },
        [images, onChange, mode]
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
        const url = images[i];
        // se fosse blob: podíamos libertar URL, mas agora usamos data:
        if (url.startsWith("blob:")) {
            URL.revokeObjectURL(url.split("#")[0]);
        }
        const next = images.slice();
        next.splice(i, 1);
        onChange(next);
    };

    const extsLabel =
        mode === "image"
            ? "JPG · PNG · WEBP · GIF"
            : mode === "video"
                ? "MP4 · WEBM · MOV · MKV"
                : "JPG · PNG · MP4 · WEBM · MOV";

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
                    <div className="imgdrop__icon">
                        {uploading ? "⏳" : "⬆️"}
                    </div>
                    <div>
                        <div className="imgdrop__text">
                            {uploading
                                ? "A enviar ficheiros…"
                                : "Arrasta ficheiros para aqui"}
                        </div>
                        {!uploading && (
                            <div className="imgdrop__hint">
                                …ou clica para escolher ficheiros
                            </div>
                        )}
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
                    {images.map((it, idx) => (
                        <li key={idx} className="imgdrop__item">
                            <span className="imgdrop__name">{prettyName(it)}</span>
                            <button
                                type="button"
                                className="imgdrop__remove"
                                onClick={() => removeItem(idx)}
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}