import React from "react";
import "./ModalShell.scss";

type Props = {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
};

export default function ModalShell({ open, onClose, children, className }: Props) {
    if (!open) return null;

    return (
        <div className={`modal-shell__overlay ${className ?? ""}`} onClick={onClose}>
            <div className="modal-shell__card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                {children}
            </div>
        </div>
    );
}