import React from "react";
import "./LoadingOverlay.scss";
import logoPt from "@/assets/logo.png";

type LoadingOverlayProps = {
    message?: string;
    compact?: boolean;
    tagline?: string;
};

export default function LoadingOverlay({
                                           message = "Estamos a carregar os dados",
                                           compact = false,
                                           tagline = "Cultura, natureza e identidade num só mapa.",
                                       }: LoadingOverlayProps) {
    return (
        <div
            className="loading-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className={`loading-card ${compact ? "compact" : ""}`}>
                {!compact && (
                    <img
                        src={logoPt}
                        alt=".PT"
                        className="loading-logo-img"
                        draggable={false}
                    />
                )}

                <div className="loading-spinner" aria-hidden="true" />

                <p className="loading-message">
                    {message}
                    <span className="ellipsis" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
                </p>
            </div>
        </div>
    );
}