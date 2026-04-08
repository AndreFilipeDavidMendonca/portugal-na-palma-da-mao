import React from "react";
import ReactDOM from "react-dom";
import {
  dismissToast,
  subscribeToToasts,
  type ToastAction,
  type ToastItem,
} from "@/components/Toastr/toast";
import "./toast.scss";

type Props = {
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

function Icon({ type }: { type: ToastItem["type"] }) {
  if (type === "success") return <span className="toast__icon">✓</span>;
  if (type === "error") return <span className="toast__icon">!</span>;
  return <span className="toast__icon">i</span>;
}

async function handleActionClick(toastId: string, action: ToastAction) {
  try {
    await action.onClick?.();
  } finally {
    if (action.dismissOnClick !== false) {
      dismissToast(toastId);
    }
  }
}

function ToastCard({ t }: { t: ToastItem }) {
  const hasActions = Boolean(t.actions?.length);

  React.useEffect(() => {
    if (t.durationMs <= 0) return;

    const timer = setTimeout(() => {
      dismissToast(t.id);
    }, t.durationMs);

    return () => clearTimeout(timer);
  }, [t.id, t.durationMs]);

  return (
    <div
      className={`toast toast--${t.type} ${hasActions ? "toast--with-actions" : ""}`}
      role="status"
      aria-live={t.type === "error" ? "assertive" : "polite"}
    >
      {!hasActions && (
        <div className="toast__left">
          <Icon type={t.type} />
        </div>
      )}

      <div className="toast__content">
        <div className="toast__msg">{t.message}</div>

        {hasActions ? (
          <div className="toast__actions">
            {t.actions!.map((action, index) => (
              <button
                key={`${t.id}-${index}-${action.label}`}
                type="button"
                className={`toast__action toast__action--${action.variant ?? "default"}`}
                onClick={() => {
                  void handleActionClick(t.id, action);
                }}
                aria-label={action.ariaLabel ?? action.label}
                title={action.ariaLabel ?? action.label}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="toast__close"
        onClick={() => dismissToast(t.id)}
        aria-label="Fechar"
        title="Fechar"
      >
        ×
      </button>
    </div>
  );
}

export default function ToastHost({ position = "top-right" }: Props) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const unsub = subscribeToToasts(setToasts);
    return () => unsub();
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