// src/components/MediaSlideshow.tsx
import React, { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import "./MediaSlideshow.scss";

type Props = {
    items: string[];
    title?: string;
    /** ms entre slides (se > 0 e houver >1 item) */
    autoPlayMs?: number;
};

// src/components/MediaSlideshow.tsx
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i;

// detecta vídeo mesmo quando vem como blob:...#name=ficheiro.mp4 ou data:video/...
const isVideo = (raw: string) => {
    if (!raw) return false;

    if (raw.startsWith("data:")) {
        // data:video/...
        return /^data:video\//i.test(raw);
    }

    const namePart = raw.split("#name=")[1] ?? raw;
    return VIDEO_EXT.test(namePart.toLowerCase());
};

// resolve o que vem do BE / FE para uma URL real
const resolveMediaUrl = (raw: string): string => {
    if (!raw) return "";

    // já é absoluto, blob ou data URL
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;

    // caminhos relativos que já começam por /
    if (raw.startsWith("/")) return `${API_BASE}${raw}`;

    // fallback legacy: só o nome do ficheiro
    return `${API_BASE}/uploads/districts/${encodeURIComponent(raw)}`;
};


const guessVideoMime = (raw: string): string | undefined => {
    const lower = raw.toLowerCase();
    if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".ogg") || lower.endsWith(".ogv")) return "video/ogg";
    if (lower.endsWith(".mov")) return "video/quicktime";
    return undefined;
};

export default function MediaSlideshow({
   items,
   title = "Galeria",
   autoPlayMs = 4000,
}: Props) {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const count = items.length;
    const currentRaw = count > 0 ? items[active % count] : null;
    const currentSrc = currentRaw ? resolveMediaUrl(currentRaw) : null;

    // se a lista mudar e o índice ficar fora, volta a 0
    useEffect(() => {
        if (active >= count) setActive(0);
    }, [count, active]);

    // autoplay por timer (independente de ser vídeo ou imagem)
    useEffect(() => {
        if (paused || count <= 1 || autoPlayMs <= 0) return;
        timerRef.current = setTimeout(
            () => setActive((i) => (i + 1) % count),
            autoPlayMs
        );
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [active, paused, count, autoPlayMs]);

    const next = () => setActive((i) => (i + 1) % count);
    const prev = () => setActive((i) => (i - 1 + count) % count);

    if (!currentSrc) {
        return (
            <div className="slideshow">
                <div className="slideshow__empty">
                    Ainda não adicionaste imagens ou vídeos aqui.
                </div>
            </div>
        );
    }

    const video = isVideo(currentRaw ?? "");
    const mime = currentRaw ? guessVideoMime(currentRaw) : undefined;

    return (
        <div
            className="slideshow"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div className="slideshow__media">
                {video ? (
                    <video
                        key={currentSrc}
                        className="slideshow__video"
                        controls
                        onEnded={next}
                        onError={(e) => {
                            console.error(
                                "[MediaSlideshow] erro a carregar vídeo:",
                                currentSrc,
                                e
                            );
                        }}
                    >
                        <source
                            src={currentSrc}
                            {...(mime ? { type: mime } : {})}
                        />
                        O teu browser não suporta vídeo HTML5.
                    </video>
                ) : (
                    <img
                        key={currentSrc}
                        className="slideshow__image"
                        src={currentSrc}
                        alt={title}
                        loading="lazy"
                    />
                )}
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        className="slideshow__nav slideshow__nav--prev"
                        onClick={prev}
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        className="slideshow__nav slideshow__nav--next"
                        onClick={next}
                    >
                        ›
                    </button>

                    <div className="slideshow__dots">
                        {items.map((_, idx) => (
                            <button
                                type="button"
                                key={idx}
                                className={
                                    "slideshow__dot" +
                                    (idx === active
                                        ? " slideshow__dot--active"
                                        : "")
                                }
                                onClick={() => setActive(idx)}
                                aria-label={`Ir para slide ${idx + 1}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}