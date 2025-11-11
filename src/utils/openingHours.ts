// utils/openingHours.ts
export type GOpeningHours = {
    open_now?: boolean;
    periods?: any[];
    weekday_text?: string[];
};

/** Extrai só o "HH:MM–HH:MM" de cada linha do weekday_text */
function parseTimes(weekday_text: string[]): string[] {
    return weekday_text.map(line => {
        // "segunda-feira: 07:30 – 23:30" -> "07:30–23:30"
        const parts = line.split(":");
        const times = parts.slice(1).join(":").trim();
        // normaliza o traço e espaços finos
        return times.replace(/\s*[\u2009\u202f]?\s*–\s*/g, "–").replace(/\s+/g, " ").trim();
    });
}

/** Retorna:
 *  - "Todos os dias - das HH:MM às HH:MM" quando é igual todos os dias e não é "Fechado"
 *  - Caso contrário, retorna o array original do Google (weekday_text) sem alterações
 */
export function compactOpeningHours(
    oh: GOpeningHours | { weekday_text: string[] } | string[]
): string | string[] {
    const weekday = Array.isArray(oh)
        ? oh
        : ("weekday_text" in (oh as any) ? (oh as any).weekday_text as string[] : []);

    if (!weekday || weekday.length !== 7) return weekday ?? "";

    const times = parseTimes(weekday);

    // todos os dias iguais?
    const allSame = times.every(t => t === times[0]);

    // se todos iguais e não é "Fechado", devolve string compacta
    const isClosedEveryday = /fechado/i.test(times[0]);
    if (allSame && !isClosedEveryday) {
        const [open, close] = times[0].split("–").map(s => s.trim());
        if (open && close) {
            return `Todos os dias - das ${open} às ${close}`;
        }
        // fallback se não conseguir separar
        return `Todos os dias - ${times[0]}`;
    }

    // caso geral: retorna como vem do Google (sem “exceções” ou agrupamentos)
    return weekday;
}