export type ToastType = "info" | "success" | "error";

export type ToastAction = {
  label: string;
  ariaLabel?: string;
  variant?: "default" | "danger" | "success";
  onClick?: () => void | Promise<void>;
  dismissOnClick?: boolean;
};

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
  createdAt: number;
  actions?: ToastAction[];
};

type ToastListener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<ToastListener>();

function emit() {
  for (const l of listeners) l(items);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  listener(items);
  return () => listeners.delete(listener);
}

export function dismissToast(id: string) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function clearToasts() {
  items = [];
  emit();
}

export type ShowToastOptions = {
  type?: ToastType;
  durationMs?: number;
  actions?: ToastAction[];
};

export function showToast(message: string, opts: ShowToastOptions = {}) {
  const hasActions = (opts.actions?.length ?? 0) > 0;

  const toast: ToastItem = {
    id: uid(),
    type: opts.type ?? "info",
    message,
    durationMs: opts.durationMs ?? (hasActions ? 0 : 5000),
    createdAt: Date.now(),
    actions: opts.actions,
  };

  items = [toast, ...items].slice(0, 5);
  emit();
  return toast.id;
}

export const toast = {
  info: (message: string, opts: Omit<ShowToastOptions, "type"> = {}) =>
    showToast(message, { ...opts, type: "info" }),

  success: (message: string, opts: Omit<ShowToastOptions, "type"> = {}) =>
    showToast(message, { ...opts, type: "success" }),

  error: (message: string, opts: Omit<ShowToastOptions, "type"> = {}) =>
    showToast(message, { ...opts, type: "error" }),

  confirm: (
    message: string,
    {
      confirmLabel = "✓",
      cancelLabel = "×",
      onConfirm,
      onCancel,
      durationMs = 0,
    }: {
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm?: () => void | Promise<void>;
      onCancel?: () => void | Promise<void>;
      durationMs?: number;
    } = {}
  ) =>
    showToast(message, {
      type: "info",
      durationMs,
      actions: [
        {
          label: cancelLabel,
          ariaLabel: "Cancelar",
          variant: "default",
          onClick: onCancel,
        },
        {
          label: confirmLabel,
          ariaLabel: "Confirmar",
          variant: "success",
          onClick: onConfirm,
        },
      ],
    }),

  dismiss: dismissToast,
  clear: clearToasts,
};