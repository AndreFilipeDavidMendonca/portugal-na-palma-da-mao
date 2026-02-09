// src/components/Toastr/toast.ts
export type ToastType = "info" | "success" | "error";

export type ToastItem = {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    durationMs: number;
    createdAt: number;
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

    // ✅ IMPORTANT: return void, not boolean
    return () => {
        listeners.delete(listener);
    };
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
    title?: string;
    durationMs?: number;
};

export function showToast(message: string, opts: ShowToastOptions = {}) {
    const toast: ToastItem = {
        id: uid(),
        type: opts.type ?? "info",
        title: opts.title,
        message,
        durationMs: opts.durationMs ?? 3500,
        createdAt: Date.now(),
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
    dismiss: dismissToast,
    clear: clearToasts,
};