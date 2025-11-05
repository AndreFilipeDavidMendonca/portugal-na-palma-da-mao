export async function loadGeo(path: string) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    const text = await res.text();

    // Se vier HTML ou ponteiro LFS, lança erro explícito
    if (/^\s*</.test(text) || /^version https:\/\/git-lfs.github.com\/spec\/v1/m.test(text)) {
        throw new Error(`Conteúdo inesperado em ${path} (HTML ou ponteiro LFS).`);
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Conteúdo recebido:', text.slice(0, 200));
        throw new Error(`JSON inválido em ${path}: ${(e as Error).message}`);
    }
}