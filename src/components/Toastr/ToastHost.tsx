import React from "react";
import ReactDOM from "react-dom";
import { dismissToast, subscribeToToasts, type ToastItem } from "./toast";
import "./toast.scss";
import Button from "@/components/Button/Button";

type Props = {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

function Icon({ type }: { type: ToastItem["type"] }) {
    if (type === "success") return <span className="toast__icon">✓</span>;
    if (type === "error") return <span className="toast__icon">!</span>;
    return <span className="toast__icon">i</span>;
}

function ToastCard({ t }: { t: ToastItem }) {
    React.useEffect(() => {
        if (t.durationMs <= 0) return;

        const timer = setTimeout(() => {
            dismissToast(t.id);
        }, t.durationMs);

        return () => clearTimeout(timer);
    }, [t.id, t.durationMs]);

    return (
        <div
            className={`toast toast--${t.type}`}
            role="status"
            aria-live={t.type === "error" ? "assertive" : "polite"}
        >
            <div className="toast__left">
                <Icon type={t.type} />
            </div>

            <div className="toast__msg">
                {t.message}
            </div>

            <Button
                className="toast__close"
                onClick={() => dismissToast(t.id)}
                aria-label="Fechar"
            >
                ×
            </Button>
        </div>
    );
}

export default function ToastHost({ position = "top-right" }: Props) {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    React.useEffect(() => {
        const unsub = subscribeToToasts(setToasts);
        return () => {
            unsub();
        };
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