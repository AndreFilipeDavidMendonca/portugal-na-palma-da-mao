import type { DistrictDto } from "@/lib/api";
import Input from "@/components/Input/TextField/Input";
import Select from "@/components/Input/Select/Select";
import type { FieldKey } from "./types";
import { normalizePostalCode } from "./utils";

type Props = {
  districts: DistrictDto[];
  districtId: number | "";
  municipality: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  geoStatus: string | null;
  loading: boolean;
  isInvalid: (field: FieldKey) => boolean;
  setFieldTouched: (field: FieldKey) => void;
  clearFieldError: (field: FieldKey) => void;
  setDistrictId: (value: number | "") => void;
  setMunicipality: (value: string) => void;
  setStreet: (value: string) => void;
  setHouseNumber: (value: string) => void;
  setPostalCode: (value: string) => void;
};

export default function CreatePoiStepAddress({
  districts,
  districtId,
  municipality,
  street,
  houseNumber,
  postalCode,
  geoStatus,
  loading,
  isInvalid,
  setFieldTouched,
  clearFieldError,
  setDistrictId,
  setMunicipality,
  setStreet,
  setHouseNumber,
  setPostalCode,
}: Props) {
  return (
    <>
      <div className="create-poi-label-row">
        <label className="create-poi-label" htmlFor="create-poi-district">
          Morada
        </label>
      </div>

      <div className="create-poi-grid">
        <Select
          id="create-poi-district"
          invalid={isInvalid("districtId")}
          value={districtId}
          onBlur={() => setFieldTouched("districtId")}
          onChange={(e) => {
            setDistrictId(e.target.value ? Number(e.target.value) : "");
            clearFieldError("districtId");
          }}
          disabled={loading}
        >
          <option value="">Seleciona o distrito…</option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.namePt ?? district.name}
            </option>
          ))}
        </Select>

        <Input
          placeholder="Concelho"
          value={municipality}
          onBlur={() => setFieldTouched("municipality")}
          onChange={(e) => {
            setMunicipality(e.target.value);
            clearFieldError("municipality");
          }}
          disabled={loading}
          autoComplete="address-level2"
          invalid={isInvalid("municipality")}
        />

        <Input
          placeholder="Rua"
          value={street}
          onBlur={() => setFieldTouched("street")}
          onChange={(e) => {
            setStreet(e.target.value);
            clearFieldError("street");
          }}
          disabled={loading}
          autoComplete="street-address"
          invalid={isInvalid("street")}
        />

        <Input
          placeholder="Nº"
          value={houseNumber}
          onBlur={() => setFieldTouched("houseNumber")}
          onChange={(e) => {
            setHouseNumber(e.target.value);
            clearFieldError("houseNumber");
          }}
          disabled={loading}
          inputMode="numeric"
          autoComplete="address-line2"
          invalid={isInvalid("houseNumber")}
        />
      </div>

      <div className="create-poi-grid create-poi-grid--postal">
        <Input
          placeholder="Código Postal"
          value={postalCode}
          onBlur={() => setFieldTouched("postalCode")}
          onChange={(e) => {
            setPostalCode(normalizePostalCode(e.target.value));
            clearFieldError("postalCode");
          }}
          disabled={loading}
          inputMode="numeric"
          autoComplete="postal-code"
          invalid={isInvalid("postalCode")}
        />
      </div>

      {(geoStatus || isInvalid("latlon")) && (
        <div
          className={`create-poi-geo ${
            isInvalid("latlon") ? "is-invalid-block is-invalid-text" : ""
          }`}
        >
          {geoStatus ?? "Morada não localizada."}
        </div>
      )}
    </>
  );
}