import React from "react";
import MediaSlideshow from "@/components/MediaSlideshow";
import "./MediaStack.scss";

type Props = {
    title?: string;
    items: string[];

    /** Altura estável do slideshow (desktop) */
    frameHeight?: string; // ex: "clamp(320px, 52vh, 680px)"

    /** Altura em mobile (opcional) */
    frameHeightMobile?: string;

    /** Conteúdo abaixo do slideshow (ex: comments) */
    children?: React.ReactNode;

    /** Conteúdo “extra” (ex: ImageDropField) com scroll próprio */
    editor?: React.ReactNode;

    /** Se quiseres controlar o max-width do slideshow */
    maxWidth?: string; // ex: "920px"
};

export default function MediaStack({
                                       title,
                                       items,
                                       frameHeight = "clamp(320px, 52vh, 680px)",
                                       frameHeightMobile = "clamp(240px, 42vh, 520px)",
                                       children,
                                       editor,
                                       maxWidth = "920px",
                                   }: Props) {
    return (
        <div
            className="media-stack"
            style={
                {
                    ["--ms-frame-h" as any]: frameHeight,
                    ["--ms-frame-h-m" as any]: frameHeightMobile,
                    ["--ms-max-w" as any]: maxWidth,
                } as React.CSSProperties
            }
        >
            <div className="media-stack__slideshow">
                <div className="media-stack__slideshow-inner">
                    <MediaSlideshow items={items} title={title} />
                </div>
            </div>

            {editor ? <div className="media-stack__editor gold-scroll">{editor}</div> : null}

            {children ? <div className="media-stack__below">{children}</div> : null}
        </div>
    );
}