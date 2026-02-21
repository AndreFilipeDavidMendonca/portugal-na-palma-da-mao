import React from "react";
import "./Input.scss";

export type TextareaVariant = "default" | "panel";
export type TextareaSize = "xs" | "sm" | "md" | "lg";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> & {
  variant?: TextareaVariant;
  size?: TextareaSize;
  pill?: boolean;
  fullWidth?: boolean;
  invalid?: boolean;
  /** Dynamic CSS via inline style / CSS variables */
  css?: React.CSSProperties;
  /** Keep support for style too */
  style?: React.CSSProperties;
};

export default function Textarea({
  variant = "default",
  size = "md",
  pill = false,
  fullWidth = true,
  invalid = false,
  className = "",
  css,
  style,
  ...rest
}: Props) {
  const cls = [
    "ui-textarea",
    variant !== "default" ? `ui-textarea--${variant}` : "",
    `ui-textarea--${size}`,
    pill ? "ui-textarea--pill" : "",
    invalid ? "ui-textarea--invalid" : "",
    fullWidth ? "ui-textarea--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mergedStyle: React.CSSProperties | undefined =
    css || style ? { ...(style || {}), ...(css || {}) } : undefined;

  return <textarea {...rest} className={cls} style={mergedStyle} />;
}
