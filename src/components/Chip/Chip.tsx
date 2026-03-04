import React from "react";
import "./Chip.scss";

export type ChipVariant = "default" | "poi";
export type ChipSize = "sm" | "md";

type ElementType = React.ElementType;

type OwnProps = {
  variant?: ChipVariant;
  size?: ChipSize;
  pill?: boolean;
  /** Selected state (e.g. filter enabled) */
  selected?: boolean;
  /** Group chip (e.g. Cultura ▾) */
  group?: boolean;
  /** Group is open */
  open?: boolean;
  fullWidth?: boolean;
  /** Dynamic CSS via inline style / CSS variables */
  css?: React.CSSProperties;
  /** Keep support for style too */
  style?: React.CSSProperties;
  className?: string;
};

export type ChipProps<E extends ElementType> = {
  as?: E;
} & OwnProps & Omit<React.ComponentPropsWithoutRef<E>, keyof OwnProps | "as" | "style" | "className">;

export default function Chip<E extends ElementType = "button">({
  as,
  variant = "default",
  size = "md",
  pill = true,
  selected = false,
  group = false,
  open = false,
  fullWidth = false,
  className,
  css,
  style,
  ...rest
}: ChipProps<E>) {
  const Comp = (as ?? "button") as ElementType;

  const mergedStyle: React.CSSProperties | undefined =
    css || style ? { ...(style || {}), ...(css || {}) } : undefined;

  const cls = [
    "ui-chip",
    `ui-chip--${variant}`,
    `ui-chip--${size}`,
    pill ? "ui-chip--pill" : "",
    selected ? "ui-chip--selected" : "",
    group ? "ui-chip--group" : "",
    open ? "ui-chip--open" : "",
    fullWidth ? "ui-chip--full" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  // Default type="button" when rendering a real button
  const extraProps: Record<string, unknown> = {};
  if (Comp === "button" && !(rest as any).type) extraProps.type = "button";

  // If this chip is being used as a toggle button, keep aria-pressed consistent
  if (Comp === "button" && (rest as any)["aria-pressed"] === undefined && (selected || group)) {
    (extraProps as any)["aria-pressed"] = selected || open;
  }

  return (
    <Comp
      {...(rest as any)}
      {...extraProps}
      className={cls}
      style={mergedStyle}
    />
  );
}
