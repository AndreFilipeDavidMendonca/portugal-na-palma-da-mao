import React from "react";
import "./Button.scss";

type ButtonVariant = "default" | "primary" | "gold" | "danger" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    /** Rounded pill (999px) like the District UI */
    pill?: boolean;
    /** Strong emphasis (font-weight 900) for primary actions / links */
    strong?: boolean;
    /** Dynamic CSS via inline style / CSS variables */
    css?: React.CSSProperties;
};

export default function Button({
                                   variant = "default",
                                   size = "md",
                                   fullWidth = false,
                                   pill = false,
                                   strong = false,
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
        pill ? "ui-btn--pill" : "",
        strong ? "ui-btn--strong" : "",
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