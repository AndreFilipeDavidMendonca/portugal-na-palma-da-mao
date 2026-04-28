import React, { useMemo } from "react";
import "./DistrictGalleryPane.scss";

import DistrictMedia from "@/components/DistrictMedia/DistrictMedia";
import { MAX_MEDIA_ITEMS } from "@/constants/media";
import { uniqStrings } from "@/utils/collections";

type Props = {
  open: boolean;
  districtName: string;
  baseUrls: string[];
  onClose: () => void;
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>;

  editing: boolean;
  isAdmin: boolean;

  distMedia: string[];
  setDistMedia: (v: string[]) => void;
  districtId?: number | null;
};

function toUrlList(input: any): string[] {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((x) => {
      if (typeof x === "string") return x;
      return x?.url || x?.src || x?.image || x?.thumb || "";
    })
    .filter((s: any) => typeof s === "string" && s.trim().length > 0);
}

export default function DistrictGalleryPane({
  open,
  districtName,
  editing,
  isAdmin,
  distMedia,
  setDistMedia,
  districtId,
  baseUrls,
}: Props) {
  const isEditing = Boolean(editing && isAdmin);

  const displayItems = useMemo(() => {
    return uniqStrings([
      ...toUrlList(distMedia),
      ...toUrlList(baseUrls),
    ]).slice(0, MAX_MEDIA_ITEMS);
  }, [distMedia, baseUrls]);

  if (!open) return null;

  return (
    <section className={`district-gallery-pane ${isEditing ? "is-editing" : ""}`}>
      <div className="district-gallery-pane__body">
        {displayItems.length === 0 ? (
          <div className="district-gallery-pane__empty">Sem media encontrado.</div>
        ) : (
          <DistrictMedia
            districtName={districtName}
            items={displayItems}
            editing={editing}
            canEdit={isAdmin}
            mediaList={distMedia}
            setMediaList={setDistMedia}
            districtId={districtId ?? null}
            maxItems={MAX_MEDIA_ITEMS}
          />
        )}
      </div>
    </section>
  );
}