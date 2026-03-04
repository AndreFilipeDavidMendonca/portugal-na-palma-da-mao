import React, { forwardRef } from "react";
import "../TextField/Input.scss";

export type SelectVariant = "default" | "panel" | "inline" | "title";
export type SelectSize = "xs" | "sm" | "md" | "lg";

type Props = Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "style" | "size"
> & {
    variant?: SelectVariant;
    size?: SelectSize;
    pill?: boolean;
    fullWidth?: boolean;
    invalid?: boolean;
    css?: React.CSSProperties;
    style?: React.CSSProperties;
};

const Select = forwardRef<HTMLSelectElement, Props>(
    (
        {
            variant = "default",
            size = "md",
            pill = false,
            fullWidth = true,
            invalid = false,
            className = "",
            css,
            style,
            ...rest
        },
        ref
    ) => {
        const cls = [
            "ui-select",
            variant !== "default" ? `ui-select--${variant}` : "",
            `ui-select--${size}`,
            pill ? "ui-select--pill" : "",
            invalid ? "ui-select--invalid" : "",
            fullWidth ? "ui-select--full" : "",
            className,
        ]
            .filter(Boolean)
            .join(" ");

        const mergedStyle =
            css || style ? { ...(style || {}), ...(css || {}) } : undefined;

        return <select ref={ref} {...rest} className={cls} style={mergedStyle} />;
    }
);

Select.displayName = "Select";

export default Select;