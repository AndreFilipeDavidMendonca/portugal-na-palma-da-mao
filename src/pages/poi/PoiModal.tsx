// src/pages/poi/PoiModal.tsx
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
const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function expandDayToken(tok: string): string[] {
    if (tok.includes("-")) {
        const [a, b] = tok.split("-");
        const i = DAY_ORDER.indexOf(a);
        const j = DAY_ORDER.indexOf(b);
        if (i >= 0 && j >= 0 && i <= j) return DAY_ORDER.slice(i, j + 1);
    }
    return DAY_ORDER.includes(tok) ? [tok] : [];
}
function daysLabel(days: string[]): string {
    if (days.length === 0) return "";
    const first = days[0], last = days[days.length - 1];
    if (days.join() === ["Mo","Tu","We","Th","Fr"].join()) return "Segunda a sexta";
    if (days.join() === DAY_ORDER.join()) return "Segunda a domingo";
    if (days.join() === ["Sa","Su"].join()) return "Sábado e domingo";
    if (days.length > 1 && DAY_ORDER.indexOf(last) - DAY_ORDER.indexOf(first) === days.length - 1) {
        return `${DAY_PT[first]} a ${DAY_PT[last]}`;
    }
    return days.map(d => DAY_PT[d]).join(", ");
}

/** Formata strings simples do opening_hours em PT legível. */
function formatOpeningHours(raw?: string | null): string | null {
    if (!raw) return null;
    try {
        const rules = raw.split(";").map(s => s.trim()).filter(Boolean);
        const parts: string[] = [];
        for (const r of rules) {
            const [daysPart, timesPart] = r.split(/\s+/, 2);
            if (!daysPart) continue;
            const dayGroups = daysPart.split(",").flatMap(expandDayToken);
            const label = daysLabel(dayGroups);
            if (!timesPart || /off|closed/i.test(timesPart)) {
                parts.push(`${label}: fechado`);
            } else {
                const hours = timesPart
                    .split(",")
                    .map(s => s.trim().replace("-", "–"))
                    .join(" · ");
                parts.push(`${label}: ${hours}`);
            }
        }
        return parts.join(" · ");
    } catch {
        return raw;
    }
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
    const ohText = formatOpeningHours(info.openingHours?.raw ?? null);
    const contacts = info.contacts ?? {};
    const website = info.website ?? contacts.website ?? null;

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
    console.log(info);

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
                            {info.inception ? <> · <span className="muted">c.</span> {info.inception}</> : null}
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
                    <aside className="poi-side">
                        {/* Botões: Site oficial + Direções */}
                        {(website || info.coords) && (
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
                                    <a
                                        className="btn-directions"
                                        href={website}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Site oficial
                                    </a>
                                )}
                                {info.coords && (
                                    <a
                                        className="btn-directions"
                                        href={`https://www.google.com/maps/search/?api=1&query=${info.coords.lat},${info.coords.lon}`}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Direções
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Divisor */}
                        <div className="meta-divider" />

                        {/* Rating (discreto) */}
                        {rating && (
                            <p className="poi-desc" style={{ marginTop: 0 }}>
                                {renderStars(rating.value)}{" "}
                                <span style={{ opacity: 0.85, marginLeft: 6 }}>
                  {rating.value.toFixed(1)}
                </span>
                            </p>
                        )}

                        {/* Contactos + Horário */}
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
                                    <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
                                </div>
                            )}
                            {ohText && (
                                <div><strong>Horário:</strong> {ohText}</div>
                            )}
                        </div>

                        {/* Descrição */}
                        {info.description ? (
                            <p className="poi-desc" style={{ textTransform: "capitalize" }}>
                                {info.description}
                            </p>
                        ) : null}

                        {/* Histórico */}
                        {info.historyText ? (
                            <>
                                <h4 className="poi-subtitle" style={{ marginTop: 12 }}>Histórico</h4>
                                <p className="poi-desc">{info.historyText}</p>
                            </>
                        ) : null}

                        {/* Arquitetura: texto + estilos/arquitetos/materiais */}
                        {(info.architectureText ||
                            (info.architectureStyles?.length || info.architects?.length || info.materials?.length)) ? (
                            <>
                                <h4 className="poi-subtitle" style={{ marginTop: 12 }}>Arquitetura</h4>

                                {/* Texto livre (DGPC/SIPA — futuro) */}
                                {info.architectureText ? (
                                    <p className="poi-desc">{info.architectureText}</p>
                                ) : null}

                                {/* Listas curtas: estilos / arquitetos / materiais */}
                                <div className="poi-info-list" style={{ display: "grid", gap: 6 }}>
                                    {info.architectureStyles?.length ? (
                                        <div><strong>Estilo:</strong> {info.architectureStyles.join(" · ")}</div>
                                    ) : null}
                                    {info.architects?.length ? (
                                        <div><strong>Arquiteto(s):</strong> {info.architects.join(", ")}</div>
                                    ) : null}
                                    {info.materials?.length ? (
                                        <div><strong>Materiais:</strong> {info.materials.join(", ")}</div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}

                        {/* Meta semântica */}
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
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
}