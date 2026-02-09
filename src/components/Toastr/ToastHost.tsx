// src/components/Toastr/ToastHost.tsx
import React from "react";
import ReactDOM from "react-dom";
import { dismissToast, subscribeToToasts, type ToastItem } from "./toast";
import "./toast.scss";

type Props = {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

function Icon({ type }: { type: ToastItem["type"] }) {
    if (type === "success") return <span className="toast__icon">✓</span>;
    if (type === "error") return <span className="toast__icon">!</span>;
    return <span className="toast__icon">i</span>;
}

function ToastCard({ t }: { t: ToastItem }) {
    const [hover, setHover] = React.useState(false);
    const [progress, setProgress] = React.useState(1);

    const startRef = React.useRef<number>(t.createdAt);
    const rafRef = React.useRef<number | null>(null);
    const pausedAtRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (t.durationMs <= 0) return;

        const tick = () => {
            const now = Date.now();
            const elapsed = now - startRef.current;
            const p = Math.max(0, 1 - elapsed / t.durationMs);
            setProgress(p);

            if (p <= 0) {
                dismissToast(t.id);
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, [t.id, t.durationMs]);

    React.useEffect(() => {
        if (t.durationMs <= 0) return;

        if (hover) {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            pausedAtRef.current = Date.now();
            return;
        }

        if (pausedAtRef.current != null) {
            const pausedFor = Date.now() - pausedAtRef.current;
            startRef.current += pausedFor;
            pausedAtRef.current = null;
        }

        const tick = () => {
            const now = Date.now();
            const elapsed = now - startRef.current;
            const p = Math.max(0, 1 - elapsed / t.durationMs);
            setProgress(p);

            if (p <= 0) {
                dismissToast(t.id);
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, [hover, t.durationMs, t.id]);

    return (
        <div
            className={`toast toast--${t.type}`}
            role="status"
            aria-live={t.type === "error" ? "assertive" : "polite"}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <div className="toast__left">
                <Icon type={t.type} />
            </div>

            <div className="toast__main">
                {t.title && <div className="toast__title">{t.title}</div>}
                <div className="toast__msg">{t.message}</div>

                {t.durationMs > 0 && (
                    <div className="toast__bar">
                        <div className="toast__barFill" style={{ transform: `scaleX(${progress})` }} />
                    </div>
                )}
            </div>

            <button className="toast__close" onClick={() => dismissToast(t.id)} aria-label="Fechar">
                ×
            </button>
        </div>
    );
}

export default function ToastHost({ position = "top-right" }: Props) {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    React.useEffect(() => {
        const unsub = subscribeToToasts(setToasts);
        return unsub;
    }, []);

    return ReactDOM.createPortal(
        <div className={`toast-host toast-host--${position}`}>
            {toasts.map((t) => (
                <ToastCard key={t.id} t={t} />
            ))}
        </div>,
        document.body
    );
}