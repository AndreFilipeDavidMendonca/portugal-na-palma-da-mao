import React from "react";
import "./Button.scss";

type ButtonVariant = "default" | "primary" | "gold" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    /** Dynamic CSS via inline style / CSS variables */
    css?: React.CSSProperties;
};

export default function Button({
                                   variant = "default",
                                   size = "md",
                                   fullWidth = false,
                                   className = "",
                                   css,
                                   style,
                                   type,
                                   ...rest
                               }: Props) {
    const cls = [
        "ui-btn",
        `ui-btn--${variant}`,
        `ui-btn--${size}`,
        fullWidth ? "ui-btn--full" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const mergedStyle: React.CSSProperties | undefined =
        css || style ? { ...(style || {}), ...(css || {}) } : undefined;

    return (
        <button
            {...rest}
            type={type ?? "button"}
            className={cls}
            style={mergedStyle}
        />
    );
}