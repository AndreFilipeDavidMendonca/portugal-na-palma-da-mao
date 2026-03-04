import React from "react";
import "./Checkbox.scss";

type Props = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "style"
> & {
    label?: React.ReactNode;
    /** Dynamic CSS vars / inline style */
    css?: React.CSSProperties;
    /** Keep style support too */
    style?: React.CSSProperties;
    /** Optional: tint color for the check (e.g. gold) */
    accent?: string;
};

export default function Checkbox({
                                     label,
                                     className = "",
                                     css,
                                     style,
                                     accent,
                                     id,
                                     ...rest
                                 }: Props) {
    const mergedStyle: React.CSSProperties | undefined =
        css || style || accent
            ? { ...(style || {}), ...(css || {}), ...(accent ? { ["--cb-accent" as any]: accent } : {}) }
            : undefined;

    // If there is a label, we prefer an id so label click works
    const inputId = id ?? (label ? `cb_${Math.random().toString(36).slice(2)}` : undefined);

    return (
        <label className={["ui-cb", className].filter(Boolean).join(" ")} style={mergedStyle}>
            <input id={inputId} type="checkbox" className="ui-cb__input" {...rest} />
            <span className="ui-cb__box" aria-hidden="true" />
            {label != null && <span className="ui-cb__label">{label}</span>}
        </label>
    );
}