import React from "react";
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
    const editor =
        editing && canEdit ? (
            <div className="poi-media__uploader">
                <ImageDropField
                    label="Imagens / vídeos"
                    images={imagesList}
                    onChange={setImagesList}
                    mode="media"
                />
            </div>
        ) : null;

    return (
        <div className="poi-media__root">
            <MediaStack
                title={title}
                items={mediaUrls}
                editor={editor}
                frameHeight="clamp(360px, 56vh, 740px)"
                frameHeightMobile="clamp(260px, 44vh, 560px)"
                maxWidth="980px"
            />
        </div>
    );
}