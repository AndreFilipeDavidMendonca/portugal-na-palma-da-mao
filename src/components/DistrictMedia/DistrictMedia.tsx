import React, { useMemo } from "react";
import ImageDropField from "@/components/ImageDropField/ImageDropField";
import MediaStack from "@/components/MediaStack/MediaStack";
import "./DistrictMedia.scss";

type Props = {
    districtName: string;
    items: string[];

    editing: boolean;
    canEdit: boolean;

    mediaList: string[];
    setMediaList: (v: string[]) => void;

    maxItems?: number;
};

const uniqStrings = (arr: string[]) => Array.from(new Set((arr ?? []).filter(Boolean)));

export default function DistrictMedia({
                                          districtName,
                                          items,
                                          editing,
                                          canEdit,
                                          mediaList,
                                          setMediaList,
                                          maxItems = 10,
                                      }: Props) {
    const showEditor = Boolean(editing && canEdit);

    const editor = showEditor ? (
        <div className="district-media__uploader">
            <ImageDropField
                label="Imagens / vídeos do distrito"
                images={mediaList}
                onChange={(list) => setMediaList(list.slice(0, maxItems))}
                mode="media"
                maxItems={maxItems}
                store="dataUrl"
            />
        </div>
    ) : null;

    const stackItems = useMemo(() => {
        const prefer = mediaList?.length ? mediaList : items;
        const src = showEditor ? mediaList : prefer;
        return uniqStrings(src).slice(0, maxItems);
    }, [showEditor, mediaList, items, maxItems]);

    // refresh leve mas suficiente
    const stackKey = useMemo(() => {
        const a = stackItems;
        const sig = `${a.length}:${a[0] ?? ""}:${a[a.length - 1] ?? ""}`;
        return `${showEditor ? "edit" : "view"}::${sig}`;
    }, [showEditor, stackItems]);

    const frameHeight = useMemo(
        () => (showEditor ? "clamp(320px, 50vh, 700px)" : "clamp(360px, 56vh, 740px)"),
        [showEditor]
    );

    const frameHeightMobile = useMemo(
        () => (showEditor ? "clamp(240px, 42vh, 560px)" : "clamp(260px, 44vh, 560px)"),
        [showEditor]
    );

    return (
        <div className={`district-media__root ${showEditor ? "is-editing" : ""}`}>
            <MediaStack
                key={stackKey}
                title={districtName}
                items={stackItems}
                editor={editor}
                frameHeight={frameHeight}
                frameHeightMobile={frameHeightMobile}
                maxWidth="980px"
            />
        </div>
    );
}