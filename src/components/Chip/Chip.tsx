import React from "react";
import "./Chip.scss";

type ElementType = React.ElementType;

type ChipProps<E extends ElementType> = {
    as?: E;
    className?: string;
    css?: React.CSSProperties;
    style?: React.CSSProperties;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "className" | "style">;

export default function Chip<E extends ElementType = "button">({
                                                                   as,
                                                                   className,
                                                                   css,
                                                                   style,
                                                                   ...rest
                                                               }: ChipProps<E>) {
    const Comp = (as ?? "button") as ElementType;

    const mergedStyle: React.CSSProperties | undefined =
        css || style ? { ...(style || {}), ...(css || {}) } : undefined;

    const cls = ["ui-chip", className].filter(Boolean).join(" ");

    const extraProps: Record<string, unknown> = {};
    if (Comp === "button" && !(rest as any).type) extraProps.type = "button";

    return (
        <Comp
            {...(rest as any)}
            {...extraProps}
            className={cls}
            style={mergedStyle}
        />
    );
}