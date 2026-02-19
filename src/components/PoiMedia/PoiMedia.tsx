import React, { useMemo } from "react";
import ImageDropField from "@/components/ImageDropField/ImageDropField";
import MediaStack from "@/components/MediaStack/MediaStack";
import "./PoiMedia.scss";

type Props = {
    title: string;
    mediaUrls: string[];
    editing: boolean;
    canEdit: boolean;
    imagesList: string[];
    setImagesList: (v: string[]) => void;
};

export default function PoiMedia({
                                     title,
                                     mediaUrls,
                                     editing,
                                     canEdit,
                                     imagesList,
                                     setImagesList,
                                 }: Props) {
    const showEditor = editing && canEdit;

    const editor = showEditor ? (
        <div className="poi-media__uploader">
            <ImageDropField
                label="Imagens / vídeos"
                images={imagesList}
                onChange={setImagesList}
                mode="media"
            />
        </div>
    ) : null;

    // Em edit: baixa um pouco o frame para abrir espaço no modal
    const frameHeight = useMemo(
        () => (showEditor ? "clamp(300px, 42vh, 520px)" : "clamp(360px, 56vh, 740px)"),
        [showEditor]
    );

    const frameHeightMobile = useMemo(
        () => (showEditor ? "clamp(220px, 34vh, 420px)" : "clamp(260px, 44vh, 560px)"),
        [showEditor]
    );

    return (
        <div className={`poi-media__root ${showEditor ? "is-editing" : ""}`}>
            <MediaStack
                title={title}
                items={mediaUrls}
                editor={editor}
                frameHeight={frameHeight}
                frameHeightMobile={frameHeightMobile}
                maxWidth="980px"
            />
        </div>
    );
}