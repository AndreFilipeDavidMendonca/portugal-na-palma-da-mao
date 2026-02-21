import React from "react";
import "./Input.scss";

export type InputVariant = "default" | "panel" | "inline" | "title";
export type InputSize = "xs" | "sm" | "md" | "lg";

type Props = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "style" | "size"
> & {
    variant?: InputVariant;
    size?: InputSize;
    pill?: boolean;
    fullWidth?: boolean;
    invalid?: boolean;
    css?: React.CSSProperties;
    style?: React.CSSProperties;
};

export default function Input({
  variant = "default",
  size = "md",
  pill = false,
  fullWidth = true,
  invalid = false,
  className = "",
  css,
  style,
  type,
  ...rest
}: Props) {
  const cls = [
    "ui-input",
    variant !== "default" ? `ui-input--${variant}` : "",
    `ui-input--${size}`,
    pill ? "ui-input--pill" : "",
    invalid ? "ui-input--invalid" : "",
    fullWidth ? "ui-input--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle: React.CSSProperties | undefined =
    css || style ? { ...(style || {}), ...(css || {}) } : undefined;

  return (
    <input
      {...rest}
      type={type ?? "text"}
      className={cls}
      style={mergedStyle}
    />
  );
}
