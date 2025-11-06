import React, { useEffect, useState } from "react";
import spinnerVideo from "@/assets/video/spinner-logo.mp4";

export default function LoadingOverlay() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // duração total: 12 segundos
        const timer = setTimeout(() => setVisible(false), 12000);
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div className="loading-overlay" aria-busy="true" aria-live="polite">
            <div className="loading-frame">
                <video
                    className="loading-video"
                    autoPlay
                    loop
                    muted
                    playsInline
                    /* src como já tens (public/ ou import) */
                >
                    <source src={spinnerVideo} type="video/mp4" />
                </video>
            </div>
        </div>
    );
}