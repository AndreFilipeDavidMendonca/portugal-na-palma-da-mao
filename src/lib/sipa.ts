// src/lib/sipa.ts
/**
 * Fetch + parse de páginas do SIPA/Monumentos.
 * Extrai blocos de texto relevantes (História, Descrição/Arquitetura, Cronologia/Datação).
 *
 * ⚠️ CORS: Monumentos/SIPA raramente expõe CORS.
 * Defina VITE_CORS_PROXY="https://seu-proxy/?" para contornar no browser.
 *
 * Exemplo de uso:
 *   const r = await fetchFromSIPA({ sipaId: "7075" });
 *   // r => { historyText, architectureText, constructedYear, sourceUrl }
 */

export type SipaResult = {
    historyText: string | null;
    architectureText: string | null;
    constructedYear: string | null; // ano ou intervalo "séc. XV", "1902", etc.
    sourceUrl: string | null;
};

const PROXY = (import.meta as any).env?.VITE_CORS_PROXY || ""; // ex.: "https://my-proxy.net/?"
const CACHE_PREFIX = "sipa:cache:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function now() { return Date.now(); }
function clampStr(s: string) { return s.replace(/\s+/g, " ").trim(); }

function cacheKey(url: string) {
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
    return `${CACHE_PREFIX}${h}`;
}
function loadCache(url: string): string | null {
    try {
        const raw = localStorage.getItem(cacheKey(url));
        if (!raw) return null;
        const { savedAt, html } = JSON.parse(raw) as { savedAt: number; html: string };
        if (now() - savedAt > CACHE_TTL_MS) return null;
        return html;
    } catch { return null; }
}
function saveCache(url: string, html: string) {
    try {
        localStorage.setItem(cacheKey(url), JSON.stringify({ savedAt: now(), html }));
    } catch {}
}

/** Tenta fazer fetch com/sem proxy conforme disponibilidade */
async function fetchHtml(url: string): Promise<string> {
    // 1) tenta cache
    const cached = loadCache(url);
    if (cached) return cached;

    // 2) tenta direto
    try {
        const r = await fetch(url, { credentials: "omit" });
        if (r.ok) {
            const html = await r.text();
            saveCache(url, html);
            return html;
        }
    } catch {
        /* cai para proxy */
    }

    // 3) tenta via proxy (se existir)
    if (PROXY) {
        const proxied = PROXY.endsWith("?") ? `${PROXY}${encodeURIComponent(url)}` : `${PROXY}${url}`;
        const r2 = await fetch(proxied, { credentials: "omit" });
        if (!r2.ok) throw new Error(`SIPA proxy HTTP ${r2.status}`);
        const html2 = await r2.text();
        saveCache(url, html2);
        return html2;
    }

    throw new Error("SIPA: CORS bloqueado e nenhum proxy definido (VITE_CORS_PROXY).");
}

/** Remove HTML, preserva quebras básicas de parágrafos/listas para leitura */
function stripHtmlKeepParagraphs(html: string): string {
    // substitui <br> e <p> por quebras
    let t = html
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*p\s*>/gi, "\n")
        .replace(/<\s*p[^>]*>/gi, "");
    // remove tags restantes
    t = t.replace(/<[^>]+>/g, "");
    // decode básico de entidades
    t = t
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&laquo;|&raquo;/g, '"')
        .replace(/&[a-zA-Z0-9#]+;/g, " "); // fallback
    // normaliza espaços e múltiplas quebras
    t = t.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
    return clampStr(t);
}

/** Extrai um bloco de texto logo após um título/label conhecido */
function extractBlockAfterLabel(html: string, labels: string[]): string | null {
    // procura por headings ou labels (H2/H3/strong/bold) e apanha o bloco seguinte
    const joined = labels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const rx = new RegExp(
        `(?:<h[23][^>]*>\\s*(?:${joined})\\s*<\\/h[23]>|<strong[^>]*>\\s*(?:${joined})\\s*<\\/strong>|<b[^>]*>\\s*(?:${joined})\\s*<\\/b>)` +
        `([\\s\\S]{0,4000}?)` + // bloco seguinte
        `(?:<h[23][^>]*>|<strong|<b|$)`,
        "i"
    );
    const m = html.match(rx);
    if (!m) return null;
    const blockHtml = m[1] ?? "";
    const text = stripHtmlKeepParagraphs(blockHtml);
    return text && text.length > 8 ? text : null;
}

/** Heurística para apanhar uma datação (ano/século) a partir de blocos */
function extractDatingFromText(...chunks: Array<string | null>): string | null {
    const txt = chunks.filter(Boolean).join("\n");
    if (!txt) return null;

    // exemplos: "século XII", "séc. XV", "Séc. XVIII", "1902", "1319", "1834-1840"
    const rx = /\b(?:(?:s[eé]c(?:\.|ulo)?)[\sªº]*([ivxlcdm]{1,4}))\b|\b(1[0-9]{3}|20[0-9]{2})(?:\s*[-–]\s*(1[0-9]{3}|20[0-9]{2}))?/gi;
    const m = rx.exec(txt);
    if (!m) return null;

    if (m[1]) {
        // século romano capturado
        const roman = m[1].toUpperCase();
        return `séc. ${roman}`;
    }

    // ano ou intervalo
    if (m[2] && m[3]) return `${m[2]}–${m[3]}`;
    if (m[2]) return m[2];
    return null;
}

/** Monta URL canónica do SIPA a partir de ID */
function sipaUrlFromId(id: string) {
    // URL pública atual (página única de imóvel)
    return `https://www.monumentos.gov.pt/Site/APP_PagesUser/SIPA.aspx?id=${encodeURIComponent(id)}`;
}

/**
 * Entrada principal de scraping do SIPA:
 * - passa `sipaId` OU `url` (se já souberes a página exata).
 * - retorna blocos textuais normalizados PT.
 */
export async function fetchFromSIPA(opts: { sipaId?: string | null; url?: string | null }): Promise<SipaResult> {
    const url = opts.url || (opts.sipaId ? sipaUrlFromId(opts.sipaId) : null);
    if (!url) return { historyText: null, architectureText: null, constructedYear: null, sourceUrl: null };

    const html = await fetchHtml(url);

    // tenta apanhar blocos por vários nomes possíveis
    const history = extractBlockAfterLabel(html, [
        "História",
        "Historial",
        "Enquadramento histórico",
        "Dados históricos"
    ]);

    const arch = extractBlockAfterLabel(html, [
        "Descrição",
        "Descrição arquitectónica",
        "Arquitectura",
        "Características arquitectónicas",
        "Caracterização"
    ]);

    const chrono = extractBlockAfterLabel(html, [
        "Cronologia",
        "Datação",
        "Época",
        "Época de construção"
    ]);

    const constructedYear = extractDatingFromText(chrono, arch, history);

    return {
        historyText: history || null,
        architectureText: arch || null,
        constructedYear: constructedYear || null,
        sourceUrl: url
    };
}

/* ------------------------ Helpers para integração futura ------------------------ */

/**
 * Tenta deduzir um possível ID/URL do SIPA a partir de um link externo,
 * caso encontres nos dados de outras APIs (OTM, Wikidata, etc.).
 */
export function guessSipaIdFromUrl(u?: string | null): string | null {
    if (!u) return null;
    try {
        const url = new URL(u);
        if (!/monumentos\.gov\.pt$/i.test(url.hostname)) return null;
        const id = url.searchParams.get("id");
        return id || null;
    } catch { return null; }
}