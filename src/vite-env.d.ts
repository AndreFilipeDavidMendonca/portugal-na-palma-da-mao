/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_MAPS_API_KEY: string;
    // adiciona aqui outras variáveis VITE_* se precisares
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}