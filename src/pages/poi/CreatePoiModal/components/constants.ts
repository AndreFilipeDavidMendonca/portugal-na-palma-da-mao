import type { Category, FieldKey, Step } from "./types";

export const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "event", label: "Evento" },
  { value: "crafts", label: "Artesanato" },
  { value: "gastronomy", label: "Gastronomia" },
  { value: "accommodation", label: "Alojamento" },
];

export const STEP_FIELDS: Record<Step, FieldKey[]> = {
  1: ["name"],
  2: ["districtId", "municipality", "street", "houseNumber", "postalCode", "latlon"],
  3: ["images"],
};