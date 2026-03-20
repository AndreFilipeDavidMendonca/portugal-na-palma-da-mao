import Input from "@/components/Input/TextField/Input";
import Textarea from "@/components/Input/TextArea/Textarea";
import Select from "@/components/Input/Select/Select";
import type { Category, FieldKey } from "./types";
import { CATEGORY_OPTIONS } from "./constants";

type Props = {
  category: Category;
  description: string;
  name: string;
  loading: boolean;
  isInvalid: (field: FieldKey) => boolean;
  setFieldTouched: (field: FieldKey) => void;
  clearFieldError: (field: FieldKey) => void;
  setCategory: (value: Category) => void;
  setDescription: (value: string) => void;
  setName: (value: string) => void;
};

export default function CreatePoiStepBusiness({
  category,
  description,
  name,
  loading,
  isInvalid,
  setFieldTouched,
  clearFieldError,
  setCategory,
  setDescription,
  setName,
}: Props) {
  return (
    <>
      <div className="create-poi-label-row">
        <label className="create-poi-label" htmlFor="create-poi-category">
          Negócio
        </label>
      </div>

      <div className="create-poi-top-grid">
        <div className="create-poi-type-block">
          <Select
            id="create-poi-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={loading}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="create-poi-description-block">
          <Textarea
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="create-poi-name-block">
          <Input
            placeholder="Nome"
            value={name}
            onBlur={() => setFieldTouched("name")}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
            disabled={loading}
            autoComplete="off"
            invalid={isInvalid("name")}
          />
        </div>
      </div>
    </>
  );
}