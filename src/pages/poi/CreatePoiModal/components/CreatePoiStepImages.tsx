import ImageDropField from "@/components/ImageDropField/ImageDropField";
import type { FieldKey } from "./types";

type Props = {
  images: string[];
  loading: boolean;
  isInvalid: (field: FieldKey) => boolean;
  clearFieldError: (field: FieldKey) => void;
  setFieldTouched: (field: FieldKey) => void;
  setImages: (value: string[]) => void;
  setImagesUploading: (value: boolean) => void;
};

export default function CreatePoiStepImages({
  images,
  loading,
  isInvalid,
  clearFieldError,
  setFieldTouched,
  setImages,
  setImagesUploading,
}: Props) {
  return (
    <>
      <div className="create-poi-label-row">
        <label className="create-poi-label">Imagens</label>
      </div>

      <div className={isInvalid("images") ? "is-invalid-block" : ""}>
        <ImageDropField
          label="Imagens do Negócio"
          images={images}
          onChange={(list) => {
            const next = list.slice(0, 6);
            setImages(next);
            clearFieldError("images");
            setFieldTouched("images");
          }}
          store="dataUrl"
          mode="media"
          maxItems={10}
          onUploadingChange={setImagesUploading}
        />
      </div>
    </>
  );
}