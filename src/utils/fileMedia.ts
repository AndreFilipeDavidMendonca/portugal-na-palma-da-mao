export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
export const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".ogg", ".m4v"];

export type MediaMode = "image" | "video" | "media";

export function isVideoUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("data:video/")) return true;

  const base = value.split("#")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => base.endsWith(ext)) || base.startsWith("blob:");
}

export function prettyMediaName(value: string): string {
  try {
    const url = new URL(value);
    if (url.hash && url.hash.startsWith("#name=")) {
      return decodeURIComponent(url.hash.slice("#name=".length));
    }

    const lastPart = url.pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(lastPart || value);
  } catch {
    if (value.startsWith("data:")) {
      const hashIndex = value.indexOf("#name=");
      if (hashIndex >= 0) return decodeURIComponent(value.slice(hashIndex + "#name=".length));
      return "ficheiro";
    }

    return value;
  }
}

export function appendNameToUrl(url: string, name: string): string {
  const safeName = encodeURIComponent(name || "ficheiro");
  return `${url}#name=${safeName}`;
}

export function matchesMediaMode(file: File, mode: MediaMode): boolean {
  if (mode === "media") return true;

  const type = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();

  if (mode === "image") {
    return type.startsWith("image/") || IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  }

  return type.startsWith("video/") || VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler ficheiro."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function getMediaAcceptAttr(mode: MediaMode): string {
  if (mode === "image") return "image/*";
  if (mode === "video") return "video/*";
  return "image/*,video/*";
}

export function getMediaFieldLabel(label: string, mode: MediaMode): string {
  if (mode === "video") return label.replace(/Imagens/i, "Vídeos");
  return label;
}

export function getMediaExtensionsLabel(mode: MediaMode): string {
  if (mode === "image") return "JPG · PNG · WEBP · GIF";
  if (mode === "video") return "MP4 · WEBM · MOV · MKV";
  return "JPG · PNG · MP4 · WEBM · MOV";
}
