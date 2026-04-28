import { API_BASE } from "@/lib/api";
import { getAuthToken } from "@/lib/authToken";

export type MediaUploadResponse = {
  storageKey: string;
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
};

export type UploadMediaOptions = {
  entityType: string;
  entityId: number;
  mediaType?: string;
  signal?: AbortSignal;
};

const MEDIA_UPLOAD_URL =
  import.meta.env.VITE_MEDIA_UPLOAD_URL || `${API_BASE}/api/media/upload`;

async function parseUploadError(res: Response) {
  const text = await res.text();
  if (!text) return `Erro HTTP ${res.status}`;

  try {
    const data = JSON.parse(text);
    return data?.message || data?.error || `Erro HTTP ${res.status}`;
  } catch {
    return text;
  }
}

export async function uploadMediaToCloud(
  file: File,
  options: UploadMediaOptions
): Promise<MediaUploadResponse> {
  if (!options.entityType?.trim()) {
    throw new Error("Tipo de entidade em falta para upload.");
  }

  if (!Number.isFinite(options.entityId)) {
    throw new Error("ID de entidade em falta para upload.");
  }

  const form = new FormData();
  form.set("file", file);
  form.set("entityType", options.entityType.trim().toUpperCase());
  form.set("entityId", String(options.entityId));
  form.set("mediaType", (options.mediaType || "FILE").trim().toUpperCase());

  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers,
    body: form,
    credentials: "omit",
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(await parseUploadError(res));
  }

  return (await res.json()) as MediaUploadResponse;
}
