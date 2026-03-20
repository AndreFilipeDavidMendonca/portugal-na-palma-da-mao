export type Category = "event" | "crafts" | "gastronomy" | "accommodation";
export type Step = 1 | 2 | 3;

export type FieldKey =
  | "name"
  | "districtId"
  | "municipality"
  | "street"
  | "houseNumber"
  | "postalCode"
  | "latlon"
  | "images";

export type FieldErrors = Partial<Record<FieldKey, string>>;