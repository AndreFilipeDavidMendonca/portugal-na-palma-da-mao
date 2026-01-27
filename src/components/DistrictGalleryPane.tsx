import React from "react";

import ImageDropField from "@/components/ImageDropField";
import MediaStack from "@/components/MediaStack";

import "./DistrictGalleryPane.scss";

type Props = {
    title: string;
    mediaUrls: string[];

    editing: boolean;
    isAdmin: boolean;
    districtId: number | null;

    distMedia: string[];
    setDistMedia: (v: string[]) => void;
};

export default function DistrictGalleryPane({
                                                title,
                                                mediaUrls,
                                                editing,
                                                isAdmin,
                                                districtId,
                                                distMedia,
                                                setDistMedia,
                                            }: Props) {
    return (
        <section className="district-gallery-left">
            <MediaStack
                title={title}
                items={mediaUrls}
                frameHeight="clamp(360px, 56vh, 740px)"
                frameHeightMobile="clamp(260px, 44vh, 560px)"
                maxWidth="980px"
                editor={
                    editing && isAdmin && districtId ? (
                        <div className="district-gallery-editor">
                            <ImageDropField
                                label="Imagens / vídeos do distrito"
                                images={distMedia}
                                onChange={setDistMedia}
                                mode="image"
                            />
                        </div>
                    ) : null
                }
            />
        </section>
    );
}