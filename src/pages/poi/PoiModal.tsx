import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import "./PoiModal.scss";

type Props = {
    open: boolean;
    onClose: () => void;
    info: PoiInfo | null;
    poi?: any;
};

/* ---------- Helpers ---------- */
const DAY_PT: Record<string, string> = {
    Mo: "Segunda",
    Tu: "Terça",
    We: "Quarta",
    Th: "Quinta",
    Fr: "Sexta",
    Sa: "Sábado",
    Su: "Domingo",
};
const DAY_SHORT_PT: Record<string, string> = {
    Mo: "Seg",
    Tu: "Ter",
    We: "Qua",
    Th: "Qui",
    Fr: "Sex",
    Sa: "Sáb",
    Su: "Dom",
};
const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function expandDayToken(tok: string): string[] {
    if (tok.includes("-")) {
        const [a, b] = tok.split("-");
        const i = DAY_ORDER.indexOf(a);
        const j = DAY_ORDER.indexOf(b);
        if (i >= 0 && j >= 0) {
            if (i <= j) return DAY_ORDER.slice(i, j + 1);
            return [...DAY_ORDER.slice(i), ...DAY_ORDER.slice(0, j + 1)];
        }
    }
    return DAY_ORDER.includes(tok) ? [tok] : [];
}

function parseOpeningHoursRaw(raw?: string | null): { str?: string; arr?: string[] } {
    if (!raw) return {};
    // se for JSON de array (guardar vindo do compactOpeningHours)
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { arr: parsed as string[] };
    } catch {
        // não é JSON — segue
    }
    return { str: raw };
}

function isContiguousRange(days: string[]): boolean {
    if (days.length <= 1) return false;
    const idxs = days.map(d => DAY_ORDER.indexOf(d)).filter(i => i >= 0);
    if (idxs.length !== days.length) return false;
    for (let k = 1; k < idxs.length; k++) {
        if (idxs[k] !== idxs[k - 1] + 1) return false;
    }
    return true;
}
function uniqueInOrder<T>(arr: T[]): T[] {
    const seen = new Set<T>();
    const out: T[] = [];
    for (const x of arr) if (!seen.has(x)) { seen.add(x); out.push(x); }
    return out;
}

/** Formata strings simples do opening_hours em PT legível.
 * Agora coloca “h” no fim das horas: 10:00h–20:00h
 */
export function formatOpeningHours(raw?: string | null, _locale = "pt-PT"): string | null {
    if (!raw) return null;

    // helper: acrescenta "h" no fim da hora capturada (ex.: "10:00" -> "10:00h")
    const withH = (t: string) => `${t}h`;

    // tenta extrair intervalo de horas
    const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const timeText = timeMatch ? `${withH(timeMatch[1])}–${withH(timeMatch[2])}` : null;

    // parte de dias (remove o pedaço de horas extraído)
    const daysPart = timeMatch ? raw.replace(timeMatch[0], "").trim() : raw.trim();

    // tokenizar por espaços e vírgulas
    const tokens = daysPart.split(/[,\s]+/).filter(Boolean);

    const hasPH = tokens.some(t => t.toUpperCase() === "PH");

    // recolhe dias, expandindo ranges
    let collected: string[] = [];
    for (const t of tokens) {
        const T = t.charAt(0).toUpperCase() + t.slice(1);
        if (/^(Mo|Tu|We|Th|Fr|Sa|Su)$/i.test(T)) {
            collected.push(T.slice(0,2) === "Mo" ? "Mo" : T.slice(0,2));
        } else if (/^[A-Z][a-z]?-[A-Z][a-z]?$/i.test(T)) {
            const [a, b] = T.split("-");
            collected.push(...expandDayToken(a + "-" + b));
        }
    }

    collected = uniqueInOrder(collected);

    let daysText = "";
    if (collected.length === 7) {
        daysText = `de ${DAY_PT["Mo"]} a ${DAY_PT["Su"]}`;
    } else if (isContiguousRange(collected)) {
        const first = collected[0];
        const last = collected[collected.length - 1];
        daysText = `de ${DAY_PT[first]} a ${DAY_PT[last]}`;
    } else if (collected.length > 0) {
        daysText = collected.map(d => DAY_SHORT_PT[d]).join(", ");
    }

    if (hasPH) {
        daysText = daysText ? `${daysText}, Feriados` : "Feriados";
    }

    if (!daysText && timeText) return timeText;
    if (daysText && timeText) return `${daysText} - ${timeText}`;
    return daysText || raw; // fallback
}

/* ----- Datas: formatação simpática ----- */
function trimISOToNice(iso?: string | null): string | null {
    if (!iso) return null;
    const s = iso.replace(/^\+/, "");
    const [y, m, d] = s.split("-");
    if (!y) return null;
    if (!m || m === "00") return y;
    if (!d || d === "00") return `${y}-${m}`;
    return `${y}-${m}-${d}`;
}

function prettifyPtInlineText(s?: string | null): string {
    if (!s) return "";
    let out = s;
    out = out.replace(/([.,;:!?])(?=\S)/g, "$1 ");
    out = out.replace(/(?<!\b[A-Za-zÀ-ÿ])\.(?=\S)/g, ". ");
    out = out.replace(/\s+([.,;:!?])/g, "$1").replace(/\s{2,}/g, " ");
    return out.trim();
}

function formatBuiltPeriod(period?: PoiInfo["builtPeriod"], inception?: string | null): string | null {
    if (period) {
        const start = trimISOToNice(period.start);
        const end = trimISOToNice(period.end);
        const opened = trimISOToNice(period.opened);
        if (start && end && start !== end) return `${start} – ${end}`;
        if (start && !end) return `c. ${start}`;
        if (!start && end) return `a ${end}`;
        if (opened) return `inaugurado em ${opened}`;
    }
    const inc = trimISOToNice(inception);
    return inc ? `c. ${inc}` : null;
}

/* ----- ReadMore: expande/contrai textos longos ----- */
function ReadMore({ text, clamp = 420 }: { text: string; clamp?: number }) {
    const [open, setOpen] = useState(false);
    if (!text) return null;
    const isLong = text.length > clamp;
    const shown = !isLong || open ? text : text.slice(0, clamp).replace(/\s+\S*$/, "") + "…";
    return (
        <p className="poi-desc">
            {shown}{" "}
            {isLong && (
                <button
                    type="button"
                    className="gold-link"
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                    onClick={() => setOpen(v => !v)}
                >
                    {open ? "ver menos" : "ver mais"}
                </button>
            )}
        </p>
    );
}

export default function PoiModal({ open, onClose, info }: Props) {
    if (!open || !info) return null;

    // Galeria
    const gallery = useMemo(() => {
        const a: string[] = [];
        if (info.image) a.push(info.image);
        for (const u of info.images ?? []) if (u && !a.includes(u)) a.push(u);
        return a;
    }, [info]);

    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const descPretty = useMemo(() => prettifyPtInlineText(info.description), [info.description]);
    const histPretty = useMemo(() => prettifyPtInlineText(info.historyText), [info.historyText]);

    useEffect(() => {
        if (paused || gallery.length <= 1) return;
        timerRef.current = setTimeout(() => setActive((i) => (i + 1) % gallery.length), 4000);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [active, paused, gallery]);

    const next = () => setActive((i) => (i + 1) % gallery.length);
    const prev = () => setActive((i) => (i - 1 + gallery.length) % gallery.length);

    const title = info.label ?? "Ponto de interesse";

    // Dados
    const hasAnyPhoto = gallery.length > 0;
    const rating = (info.ratings ?? [])[0];
    const ohParsed = parseOpeningHoursRaw(info.openingHours?.raw ?? null);
    const ohFallback = formatOpeningHours(ohParsed.str ?? null);
    const contacts = info.contacts ?? {};
    const website = info.website ?? contacts.website ?? null;
    const addHToTimes = (s: string) => s.replace(/(\b\d{1,2}:\d{2}\b)(?!h)/g, "$1h");
    const renderStars = (v: number) => {
        const full = Math.floor(v);
        const half = v - full >= 0.5;
        return (
            <span aria-label={`Rating ${v} em 5`}>
                {"★".repeat(full)}
                {half ? "☆" : ""}
                {"☆".repeat(5 - full - (half ? 1 : 0))}
            </span>
        );
    };

    // Cronologia (sub-linha do título)
    const builtLabel = formatBuiltPeriod(info.builtPeriod, info.inception);

    return ReactDOM.createPortal(
        <div className="poi-overlay" onClick={onClose}>
            <div
                className="poi-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <header className="poi-header">
                    <div className="poi-title-wrap">
                        <h2 className="poi-title">{title}</h2>
                        <div className="poi-subline">
                            {info.wikipediaUrl ? (
                                <a href={info.wikipediaUrl} target="_blank" rel="noreferrer">
                                    Página Wikipedia
                                </a>
                            ) : null}
                            {builtLabel ? <> · {builtLabel}</> : null}
                        </div>
                    </div>
                    <button className="poi-close" onClick={onClose} aria-label="Fechar">×</button>
                </header>

                <div className="poi-body">
                    {/* SLIDESHOW */}
                    <section
                        className="poi-media"
                        onMouseEnter={() => setPaused(true)}
                        onMouseLeave={() => setPaused(false)}
                    >
                        {hasAnyPhoto ? (
                            <div className="slideshow">
                                <img
                                    key={gallery[active]}
                                    src={gallery[active]}
                                    alt={title}
                                    className="poi-slide"
                                    loading="lazy"
                                />
                                {gallery.length > 1 && (
                                    <>
                                        <button className="nav prev" onClick={prev}>‹</button>
                                        <button className="nav next" onClick={next}>›</button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="no-photo">Sem fotografias</div>
                        )}
                    </section>

                    {/* INFO */}
                    <aside className="poi-side gold-scroll">
                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    marginBottom: 8,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        marginBottom: 8,
                                    }}
                                >
                                    {website && (
                                        <a className="btn-directions" href={website} target="_blank" rel="noreferrer">
                                            Site oficial
                                        </a>
                                    )}
                                    <a
                                        className="btn-directions"
                                        href={
                                            info?.coords
                                                ? `https://www.google.com/maps/search/?api=1&query=${info.coords.lat},${info.coords.lon}`
                                                : `https://www.google.com/maps/`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Direções
                                    </a>
                                </div>
                            </div>

                        <div className="meta-divider" />

                        {info.oldNames?.length ? (
                            <>
                                <strong>Nome anterior:</strong> {info.oldNames[0]}
                            </>
                        ) : null}

                        {rating && (
                            <p className="poi-desc" style={{ marginTop: 0 }}>
                                {renderStars(rating.value)}{" "}
                                <span style={{ opacity: 0.85, marginLeft: 6 }}>
                                    {rating.value.toFixed(1)}
                                </span>
                            </p>
                        )}

                        <div className="poi-info-list" style={{ display: "grid", gap: 6 }}>
                            {contacts.phone && (
                                <div>
                                    <strong>Telefone:</strong>{" "}
                                    <a href={`tel:${contacts.phone}`} className="gold-link">
                                        {contacts.phone}
                                    </a>
                                </div>
                            )}
                            {contacts.email && (
                                <div>
                                    <strong>Email:</strong>{" "}
                                    <a
                                        className="gold-link"
                                        href={`mailto:${contacts.email.replace(/\s+/g, "")}`}
                                        target="_self"
                                    >
                                        {contacts.email}
                                    </a>
                                </div>
                            )}
                            {(ohParsed.arr?.length || ohParsed.str || ohFallback) && (
                                <div>
                                    <strong>Horário:</strong>{" "}
                                    {ohParsed.str ? (
                                        // caso “Todos os dias - das … às …”
                                        <span>{addHToTimes(ohParsed.str)}</span>
                                    ) : ohParsed.arr?.length ? (
                                        // caso array vindo do Google (weekday_text)
                                        <ul className="hours-list">
                                            {ohParsed.arr.map((line, i) => (
                                                <li key={i}>{addHToTimes(line)}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        // fallback (ex.: OSM Mo-Fr 10:00-18:00 → “de Segunda a Sexta - 10:00h–18:00h”)
                                        <span>{addHToTimes(ohFallback ?? "")}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="poi-info-list" style={{ display: "grid", gap: 6, marginTop: 8 }}>
                            {info.instanceOf?.length ? (
                                <div><strong>Tipo:</strong> {info.instanceOf.join(" · ")}</div>
                            ) : null}
                            {info.locatedIn?.length ? (
                                <div><strong>Localização:</strong> {info.locatedIn.join(", ")}</div>
                            ) : null}
                            {info.heritage?.length ? (
                                <div><strong>Classificação:</strong> {info.heritage.join(" · ")}</div>
                            ) : null}
                        </div>

                        {(info.architectureText ||
                            (info.architectureStyles?.length || info.architects?.length || info.materials?.length) ||
                            (info.builders?.length) ||
                            builtLabel) ? (
                            <>
                                {info.architectureText ? (
                                    <p className="poi-desc">{info.architectureText}</p>
                                ) : null}

                                <div className="poi-info-list" style={{ display: "grid", gap: 6 }}>
                                    {builtLabel ? (
                                        <div><strong>Inicio de construção:</strong> {builtLabel}</div>
                                    ) : null}
                                    {info.architectureStyles?.length ? (
                                        <div><strong>Estilo:</strong> {info.architectureStyles.join(" · ")}</div>
                                    ) : null}
                                    {info.architects?.length ? (
                                        <div><strong>Arquiteto(s):</strong> {info.architects.join(", ")}</div>
                                    ) : null}
                                    {info.builders?.length ? (
                                        <div><strong>Construtor/Autor:</strong> {info.builders.join(", ")}</div>
                                    ) : null}
                                    {info.materials?.length ? (
                                        <div><strong>Materiais:</strong> {info.materials.join(", ")}</div>
                                    ) : null}
                                </div>

                                <div className="meta-divider" />
                            </>
                        ) : null}

                        {info.description ? (
                            <>
                                <ReadMore text={descPretty} />
                            </>
                        ) : null}

                        {info.historyText ? (
                            <>
                                <h4 className="poi-subtitle" style={{ marginTop: 12 }}>Histórico</h4>
                                <ReadMore text={histPretty} />
                            </>
                        ) : null}
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
}