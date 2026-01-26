import React from "react";
import ImageDropField from "@/components/ImageDropField";
import MediaSlideshow from "@/components/MediaSlideshow";
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
    return (
        <>
            <div className="poi-media-slideshow">
                <MediaSlideshow items={mediaUrls} title={title} />
            </div>

            {editing && canEdit && (
                <div className="poi-media-uploader">
                    <ImageDropField
                        label="Imagens / vídeos"
                        images={imagesList}
                        onChange={setImagesList}
                        mode="media"
                    />
                </div>
            )}
        </>
    );
}