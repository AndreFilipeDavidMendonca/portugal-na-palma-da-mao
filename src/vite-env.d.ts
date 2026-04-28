/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MEDIA_UPLOAD_URL?: string;
  readonly VITE_MEDIA_BASE_URL?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_DEBUG_POI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
