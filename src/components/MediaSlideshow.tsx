import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MediaSlideshow.scss";

type ReadyPayload = {
    ready: boolean;
    loaded: string[];
    failed: string[];
    total: number;
};

type Props = {
    items: string[];
    title?: string;

    /** Gate: só considera “ready” quando >= N loads OK */
    minReady?: number;

    /** Primeiro batch rápido; depois continua em background */
    preloadFirst?: number;

    /** Callback quando chega ao gate (e updates intermédios opcionalmente) */
    onReady?: (p: ReadyPayload) => void;

    /** Se true: não renderiza UI; só faz preload + onReady */
    preloadOnly?: boolean;

    /** Limite de items montados (evita DOM gigante). Default: 10 */
    mountLimit?: number;
};

const isVideoUrl = (url: string) =>
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(url.split("#name=")[1] ?? url);

const uniq = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

function preloadImage(url: string, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
        if (!url) return resolve(false);

        const img = new Image();

        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
        };

        if (signal) {
            if (signal.aborted) return resolve(false);
            signal.addEventListener(
                "abort",
                () => {
                    cleanup();
                    resolve(false);
                },
                { once: true }
            );
        }

        img.onload = () => {
            cleanup();
            resolve(true);
        };

        img.onerror = () => {
            cleanup();
            resolve(false);
        };

        img.src = url;
    });
}

function preloadVideo(url: string, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
        if (!url) return resolve(false);

        const v = document.createElement("video");

        const cleanup = () => {
            v.onloadedmetadata = null;
            v.onerror = null;
            try {
                v.src = "";
            } catch {}
        };

        if (signal) {
            if (signal.aborted) return resolve(false);
            signal.addEventListener(
                "abort",
                () => {
                    cleanup();
                    resolve(false);
                },
                { once: true }
            );
        }

        v.onloadedmetadata = () => {
            cleanup();
            resolve(true);
        };

        v.onerror = () => {
            cleanup();
            resolve(false);
        };

        v.preload = "metadata";
        v.src = url;
    });
}

export default function MediaSlideshow({
                                           items,
                                           title,
                                           minReady = 0,
                                           preloadFirst = 3,
                                           onReady,
                                           preloadOnly = false,
                                           mountLimit = 10,
                                       }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // URLs que falharam (não mostramos)
    const [broken, setBroken] = useState<Set<string>>(new Set());

    // tracking de preload
    const loadedRef = useRef<Set<string>>(new Set());
    const failedRef = useRef<Set<string>>(new Set());
    const readySentRef = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);

    // lista final (única, limitada, e sem broken)
    const visibleItems = useMemo(() => {
        const base = uniq(items).slice(0, Math.max(0, mountLimit));
        return base.filter((u) => u && !broken.has(u));
    }, [items, broken, mountLimit]);

    // manter índice válido quando o array muda
    useEffect(() => {
        setCurrentIndex((idx) => Math.min(idx, Math.max(visibleItems.length - 1, 0)));
    }, [visibleItems.length]);

    // PRELOAD: aquece cache e faz gate via onReady
    useEffect(() => {
        const list = uniq(items).slice(0, Math.max(0, mountLimit));

        loadedRef.current = new Set();
        failedRef.current = new Set();
        readySentRef.current = false;

        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        const emit = () => {
            const loaded = Array.from(loadedRef.current);
            const failed = Array.from(failedRef.current);
            const ready = minReady > 0 ? loaded.length >= minReady : true;

            if (ready && !readySentRef.current) {
                readySentRef.current = true;
                onReady?.({ ready: true, loaded, failed, total: list.length });
            } else if (!ready) {
                onReady?.({ ready: false, loaded, failed, total: list.length });
            }
        };

        if (minReady <= 0) {
            // já está “ready” — mas continuamos o preload para UX
            onReady?.({ ready: true, loaded: [], failed: [], total: list.length });
        }

        let cancelled = false;

        async function run() {
            const firstBatch = list.slice(0, Math.max(0, preloadFirst));

            for (const url of firstBatch) {
                if (cancelled || controller.signal.aborted) return;

                const ok = isVideoUrl(url)
                    ? await preloadVideo(url, controller.signal)
                    : await preloadImage(url, controller.signal);

                if (cancelled || controller.signal.aborted) return;

                if (ok) loadedRef.current.add(url);
                else failedRef.current.add(url);

                emit();
                if (minReady > 0 && loadedRef.current.size >= minReady) break;
            }

            const rest = list.slice(Math.max(0, preloadFirst));
            for (const url of rest) {
                if (cancelled || controller.signal.aborted) return;
                if (loadedRef.current.has(url) || failedRef.current.has(url)) continue;

                const ok = isVideoUrl(url)
                    ? await preloadVideo(url, controller.signal)
                    : await preloadImage(url, controller.signal);

                if (cancelled || controller.signal.aborted) return;

                if (ok) loadedRef.current.add(url);
                else failedRef.current.add(url);

                emit();
            }
        }

        run();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [items, minReady, preloadFirst, onReady, mountLimit]);

    // preloadOnly: só gate + preload
    if (preloadOnly) return null;

    const hasItems = visibleItems.length > 0;
    const idx = Math.min(currentIndex, Math.max(visibleItems.length - 1, 0));

    const goNext = () => {
        if (!hasItems) return;
        setCurrentIndex((i) => (i + 1) % visibleItems.length);
    };

    const goPrev = () => {
        if (!hasItems) return;
        setCurrentIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
    };

    const goTo = (i: number) => {
        if (!hasItems) return;
        if (i === idx) return;
        setCurrentIndex(i);
    };

    if (!hasItems) {
        return (
            <div className="slideshow">
                <div className="slideshow__frame slideshow__frame--empty">
                    <span>Sem media disponível</span>
                </div>
            </div>
        );
    }

    return (
        <div className="slideshow">
            <div className="slideshow__frame">
                {/* ✅ Monta tudo uma vez; o click só muda a classe */}
                {visibleItems.map((url, i) => {
                    const active = i === idx;
                    const video = isVideoUrl(url);

                    const onFail = () => {
                        setBroken((prev) => {
                            const next = new Set(prev);
                            next.add(url);
                            return next;
                        });
                    };

                    const onOk = () => {
                        // só desliga spinner quando o ativo carregou
                    };

                    return video ? (
                        <video
                            key={url}
                            className={"slideshow__media" + (active ? " is-active" : "")}
                            src={url}
                            controls={active}
                            preload="metadata"
                            onLoadedData={onOk}
                            onError={onFail}
                        />
                    ) : (
                        <img
                            key={url}
                            className={"slideshow__media" + (active ? " is-active" : "")}
                            src={url}
                            alt={title ?? "Imagem"}
                            loading="eager"
                            onLoad={onOk}
                            onError={onFail}
                        />
                    );
                })}

                {visibleItems.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="slideshow__arrow slideshow__arrow--left"
                            onClick={goPrev}
                            aria-label="Anterior"
                        >
                            ◀
                        </button>
                        <button
                            type="button"
                            className="slideshow__arrow slideshow__arrow--right"
                            onClick={goNext}
                            aria-label="Seguinte"
                        >
                            ▶
                        </button>
                    </>
                )}
            </div>

            {visibleItems.length > 1 && (
                <div className="slideshow__dots">
                    {visibleItems.map((_u, i) => (
                        <button
                            key={i}
                            type="button"
                            className={"slideshow__dot" + (i === idx ? " slideshow__dot--active" : "")}
                            onClick={() => goTo(i)}
                            aria-label={`Ir para media ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}