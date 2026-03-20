import type { Step } from "./types";

export function stripNameHash(url: string) {
  return url.split("#")[0];
}

export function normalizePostalCode(value: string) {
  return value.replace(/[^\d-]/g, "").trim();
}

export function getStepTitle(step: Step) {
  if (step === 1) return "Negócio";
  if (step === 2) return "Morada";
  return "Imagens";
}

export function getStepSubtitle(step: Step) {
  if (step === 1) return "Define o nome, tipo e descrição do negócio.";
  if (step === 2) return "Indica a morada para localizar o negócio com precisão.";
  return "Adiciona imagens com pré-visualização antes de guardar.";
}