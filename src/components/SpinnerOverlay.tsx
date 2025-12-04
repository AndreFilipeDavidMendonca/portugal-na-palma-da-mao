import React from "react";
import "./SpinnerOverlay.scss";

type Props = {
    open: boolean;
    message?: string;
    /** Z-index do overlay (default 10000) */
    zIndex?: number;
    /** Intensidade do blur de fundo (px) — default 6 */
    blur?: number;
    /** Opacidade do backdrop 0..1 — default 0.45 */
    backdropOpacity?: number;
    /** Clique no backdrop (opcional) */
    onClickBackdrop?: () => void;
};

export default function SpinnerOverlay({
       open,
       message = "A carregar…",
       zIndex = 10000,
       blur = 6,
       backdropOpacity = 0.45,
       onClickBackdrop,
    }: Props) {
    if (!open) return null;

    return (
        <div
            className="spinner-overlay"
            style={
                {
                    zIndex,
                    ["--overlay-blur" as any]: `${blur}px`,
                    ["--overlay-opacity" as any]: backdropOpacity,
                } as React.CSSProperties
            }
            role="status"
            aria-live="polite"
            aria-busy="true"
            onClick={onClickBackdrop}
        >
            <div className="spinner-center" onClick={(e) => e.stopPropagation()}>
                <div className="spinner-gold" aria-hidden />
                <div className="spinner-msg">{message}</div>
            </div>
        </div>
    );
}