import React, { useMemo, useState } from "react";
import "./MediaSlideshow.scss";

type Props = {
    items: string[];
    title?: string;
};

const isVideoUrl = (url: string) =>
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(url.split("#name=")[1] ?? url);

export default function MediaSlideshow({ items, title }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [broken, setBroken] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState<boolean>(true);

    // remove URLs que já falharam pelo menos uma vez
    const visibleItems = useMemo(
        () => items.filter((u) => u && !broken.has(u)),
        [items, broken]
    );

    const hasItems = visibleItems.length > 0;
    const idx = Math.min(currentIndex, Math.max(visibleItems.length - 1, 0));
    const current = hasItems ? visibleItems[idx] : null;

    const isVideo = current ? isVideoUrl(current) : false;

    const handleError = () => {
        if (!current) return;
        console.warn("[MediaSlideshow] media falhou, removido:", current);
        setBroken((prev) => {
            const s = new Set(prev);
            s.add(current);
            return s;
        });
        setLoading(false);
    };

    const handleLoaded = () => {
        setLoading(false);
    };

    const goNext = () => {
        if (!hasItems) return;
        setLoading(true);
        setCurrentIndex((i) => (i + 1) % visibleItems.length);
    };

    const goPrev = () => {
        if (!hasItems) return;
        setLoading(true);
        setCurrentIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
    };

    const goTo = (i: number) => {
        if (!hasItems) return;
        if (i === idx) return;
        setLoading(true);
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
                {/* media */}
                {isVideo ? (
                    <video
                        key={current}
                        className="slideshow__media"
                        src={current!}
                        controls
                        onError={handleError}
                        onLoadedData={handleLoaded}
                    />
                ) : (
                    <img
                        key={current}
                        className="slideshow__media"
                        src={current!}
                        alt={title ?? "Imagem"}
                        loading="lazy"
                        onError={handleError}
                        onLoad={handleLoaded}
                    />
                )}

                {/* spinner por cima do media */}
                {loading && (
                    <div className="slideshow__spinner">
                        <div className="slideshow__spinner-icon" />
                    </div>
                )}

                {/* setas laterais */}
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

            {/* bolinhas de página em baixo */}
            {visibleItems.length > 1 && (
                <div className="slideshow__dots">
                    {visibleItems.map((_u, i) => (
                        <button
                            key={i}
                            type="button"
                            className={
                                "slideshow__dot" +
                                (i === idx ? " slideshow__dot--active" : "")
                            }
                            onClick={() => goTo(i)}
                            aria-label={`Ir para media ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}