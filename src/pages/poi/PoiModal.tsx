import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom";
import type { PoiInfo } from "@/lib/poiInfo";
import ImageDropField from "@/components/ImageDropField";
import { updatePoi } from "@/lib/api";
import MediaSlideshow from "@/components/MediaSlideshow";
import "./PoiModal.scss";

type Props = {
    open: boolean;
    onClose: () => void;
    info: PoiInfo | null;
    poi?: any;
    onSaved?: (patch: {
        id: number;
        name?: string | null;
        namePt?: string | null;
        description?: string | null;
        image?: string | null;
        images?: string[] | null;
    }) => void;
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
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { arr: parsed as string[] };
    } catch {
        // não é JSON
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

type TreeNode = string | { title: string; items?: TreeNode[]; open?: boolean };

function DetailsTree({ node, level = 0 }: { node: TreeNode; level?: number }) {
    if (typeof node === "string") {
        return <li className="dtree__leaf">{node}</li>;
    }

    const { title, items = [], open = false } = node;
    const hasChildren = items && items.length > 0;

    return (
        <details className={`dtree dtree--lvl${level}`} open={open}>
            <summary className="dtree__summary">
                <span className="dtree__title">{title}</span>
                <span aria-hidden className="dtree__chev">▾</span>
            </summary>

            {hasChildren && (
                <div className="dtree__panel">
                    {items.every(i => typeof i === "string") ? (
                        <ul className="dtree__list">
                            {items.map((it, idx) => (
                                <DetailsTree key={idx} node={it} level={level + 1} />
                            ))}
                        </ul>
                    ) : (
                        <div className="dtree__children">
                            {items.map((it, idx) => (
                                <DetailsTree key={idx} node={it} level={level + 1} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </details>
    );
}

function uniqueInOrder<T>(arr: T[]): T[] {
    const seen = new Set<T>();
    const out: T[] = [];
    for (const x of arr) {
        if (!seen.has(x)) {
            seen.add(x);
            out.push(x);
        }
    }
    return out;
}

export function formatOpeningHours(raw?: string | null, _locale = "pt-PT"): string | null {
    if (!raw) return null;

    const withH = (t: string) => `${t}h`;

    const timeMatch = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    const timeText = timeMatch ? `${withH(timeMatch[1])}–${withH(timeMatch[2])}` : null;

    const daysPart = timeMatch ? raw.replace(timeMatch[0], "").trim() : raw.trim();
    const tokens = daysPart.split(/[,\s]+/).filter(Boolean);

    const hasPH = tokens.some(t => t.toUpperCase() === "PH");

    let collected: string[] = [];
    for (const t of tokens) {
        const T = t.charAt(0).toUpperCase() + t.slice(1);
        if (/^(Mo|Tu|We|Th|Fr|Sa|Su)$/i.test(T)) {
            collected.push(T.slice(0, 2) === "Mo" ? "Mo" : T.slice(0, 2));
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
    return daysText || raw;
}

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

function ReadMore({ text, clamp = 420 }: { text: string; clamp?: number }) {
    const [open, setOpen] = useState(false);
    if (!text) return null;
    const isLong = text.length > clamp;
    const shown =
        !isLong || open ? text : text.slice(0, clamp).replace(/\s+\S*$/, "") + "…";
    return (
        <p className="poi-desc">
            {shown}{" "}
            {isLong && (
                <button
                    type="button"
                    className="gold-link"
                    style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                    }}
                    onClick={() => setOpen(v => !v)}
                >
                    {open ? "ver menos" : "ver mais"}
                </button>
            )}
        </p>
    );
}

/* =========================
   MODAL
   ========================= */
export default function PoiModal({ open, onClose, info, poi, onSaved }: Props) {
    if (!open || !info) return null;

    // Estado local / edição
    const [localInfo, setLocalInfo] = useState<PoiInfo | null>(info);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [titleInput, setTitleInput] = useState("");
    const [descInput, setDescInput] = useState("");
    const [imagesList, setImagesList] = useState<string[]>([]);

    useEffect(() => {
        setLocalInfo(info);
        setEditing(false);
        setErrorMsg(null);

        if (!info) {
            setTitleInput("");
            setDescInput("");
            setImagesList([]);
            return;
        }

        setTitleInput(info.label ?? "");
        setDescInput(info.description ?? "");

        const gal: string[] = [];
        if (info.image) gal.push(info.image);
        for (const u of info.images ?? []) if (u && !gal.includes(u)) gal.push(u);
        setImagesList(gal);
    }, [info]);

    if (!localInfo) return null;
    const usedInfo = localInfo;

    // lista de media (imagens + vídeos) para o slideshow
    const mediaUrls = useMemo(() => {
        const urls: string[] = [];
        const push = (u?: string | null) => {
            if (!u) return;
            if (urls.includes(u)) return;
            urls.push(u);
        };
        push(usedInfo.image);
        for (const u of usedInfo.images ?? []) push(u);
        return urls;
    }, [usedInfo]);

    const descPretty = useMemo(
        () => prettifyPtInlineText(usedInfo.description),
        [usedInfo.description]
    );
    const histPretty = useMemo(
        () => prettifyPtInlineText(usedInfo.historyText),
        [usedInfo.historyText]
    );

    const title = usedInfo.label ?? "Ponto de interesse";
    const rating = (usedInfo.ratings ?? [])[0];
    const ohParsed = parseOpeningHoursRaw(usedInfo.openingHours?.raw ?? null);
    const ohFallback = formatOpeningHours(ohParsed.str ?? null);
    const contacts = usedInfo.contacts ?? {};
    const website = usedInfo.website ?? contacts.website ?? null;
    const builtLabel = formatBuiltPeriod(usedInfo.builtPeriod, usedInfo.inception);

    const poiId: number | null =
        typeof poi?.properties?.id === "number" ? poi.properties.id : null;

    const handleSave = async () => {
        if (!poiId) {
            setErrorMsg("Não foi possível identificar o POI (id em falta).");
            return;
        }

        const imageLines = imagesList;
        const primaryImage = imageLines[0] ?? null;

        setSaving(true);
        setErrorMsg(null);

        try {
            const updated = await updatePoi(poiId, {
                name: titleInput || null,
                namePt: titleInput || null,
                description: descInput || null,
                image: primaryImage,
                images: imageLines.length > 0 ? imageLines : null,
            });

            const newInfo: PoiInfo = {
                ...usedInfo,
                label: (updated.namePt ?? updated.name ?? titleInput) || usedInfo.label,
                description: updated.description ?? descInput,
                image: updated.image ?? primaryImage ?? usedInfo.image ?? null,
                images: updated.images ?? imageLines,
            };

            setLocalInfo(newInfo);
            setEditing(false);

            if (onSaved) {
                onSaved({
                    id: poiId,
                    name: updated.name,
                    namePt: updated.namePt,
                    description: updated.description,
                    image: updated.image,
                    images: updated.images,
                });
            }
        } catch (e: any) {
            setErrorMsg(e?.message || "Falha ao guardar alterações.");
        } finally {
            setSaving(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="poi-overlay" onClick={onClose}>
            <div
                className="poi-card"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <header className="poi-header">
                    <div className="poi-title-wrap">
                        <h2 className="poi-title">
                            {editing ? (
                                <input
                                    className="poi-edit-input"
                                    value={titleInput}
                                    onChange={e => setTitleInput(e.target.value)}
                                    placeholder="Título do ponto de interesse"
                                />
                            ) : (
                                title
                            )}
                        </h2>
                        <div className="poi-subline">
                            {usedInfo.wikipediaUrl ? (
                                <a
                                    href={usedInfo.wikipediaUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Página Wikipedia
                                </a>
                            ) : null}
                            {builtLabel ? <> · {builtLabel}</> : null}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {poiId && (
                            <button
                                className="poi-edit-btn"
                                type="button"
                                onClick={() => {
                                    setEditing(v => !v);
                                    setErrorMsg(null);
                                }}
                            >
                                {editing ? "Cancelar" : "Editar"}
                            </button>
                        )}
                        {editing && (
                            <button
                                className="poi-save-btn"
                                type="button"
                                disabled={saving}
                                onClick={handleSave}
                            >
                                {saving ? "A guardar..." : "Guardar"}
                            </button>
                        )}
                        <button
                            className="poi-close"
                            onClick={onClose}
                            aria-label="Fechar"
                            type="button"
                        >
                            ×
                        </button>
                    </div>
                </header>

                <div className="poi-body">
                    {/* MEDIA (slideshow reutilizável) */}
                    <section className="poi-media gold-scroll">
                        <MediaSlideshow items={mediaUrls} title={title} />

                        {editing && (
                            <div className="poi-media-uploader">
                                <ImageDropField
                                    label="Imagens / vídeos"
                                    images={imagesList}
                                    onChange={setImagesList}
                                    mode="media"   // ← isto permite mp4 / webm / mov / etc.
                                />
                            </div>
                        )}
                    </section>

                    {/* INFO */}
                    <aside className="poi-side gold-scroll">
                        {errorMsg && <div className="poi-error">{errorMsg}</div>}

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
                            <a
                                className="btn-directions"
                                href={
                                    usedInfo?.coords
                                        ? `https://www.google.com/maps/search/?api=1&query=${usedInfo.coords.lat},${usedInfo.coords.lon}`
                                        : `https://www.google.com/maps/`
                                }
                                target="_blank"
                                rel="noreferrer"
                            >
                                Direções
                            </a>
                        </div>

                        <div className="meta-divider" />

                        {rating && !editing && (
                            <p className="poi-desc" style={{ marginTop: 0 }}>
                                {(() => {
                                    const v = rating.value;
                                    const full = Math.floor(v);
                                    const half = v - full >= 0.5;
                                    return (
                                        <span aria-label={`Rating ${v} em 5`}>
                                            {"★".repeat(full)}
                                            {half ? "☆" : ""}
                                            {"☆".repeat(5 - full - (half ? 1 : 0))}
                                        </span>
                                    );
                                })()}{" "}
                                <span style={{ opacity: 0.85, marginLeft: 6 }}>
                                    {rating.value.toFixed(1)}
                                </span>
                            </p>
                        )}

                        {/* Contactos / Horários */}
                        <div className="poi-info-list" style={{ display: "grid", gap: 6 }}>
                            {contacts.phone && !editing && (
                                <div>
                                    <strong>Telefone:</strong>{" "}
                                    <a href={`tel:${contacts.phone}`} className="gold-link">
                                        {contacts.phone}
                                    </a>
                                </div>
                            )}
                            {contacts.email && !editing && (
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
                            {(ohParsed.arr?.length || ohParsed.str || ohFallback) && !editing && (
                                <DetailsTree
                                    node={{
                                        title: "Horário",
                                        open: false,
                                        items: ohParsed.arr?.length
                                            ? ohParsed.arr.map(line =>
                                                line
                                                    ? line.replace(
                                                        /(\b\d{1,2}:\d{2}\b)(?!h)/g,
                                                        "$1h"
                                                    )
                                                    : line
                                            )
                                            : ohFallback
                                                ? [
                                                    ohFallback.replace(
                                                        /(\b\d{1,2}:\d{2}\b)(?!h)/g,
                                                        "$1h"
                                                    ),
                                                ]
                                                : ohParsed.str
                                                    ? [
                                                        ohParsed.str.replace(
                                                            /(\b\d{1,2}:\d{2}\b)(?!h)/g,
                                                            "$1h"
                                                        ),
                                                    ]
                                                    : [],
                                    }}
                                />
                            )}
                        </div>

                        {/* Descrição / História */}
                        <div style={{ marginTop: 8 }}>
                            {editing ? (
                                <>
                                    <label className="poi-edit-label">Descrição</label>
                                    <textarea
                                        className="poi-edit-textarea"
                                        rows={10}
                                        value={descInput}
                                        onChange={e => setDescInput(e.target.value)}
                                    />
                                </>
                            ) : (
                                <>
                                    {usedInfo.description && <ReadMore text={descPretty} />}

                                    {usedInfo.historyText && (
                                        <>
                                            <h4
                                                className="poi-subtitle"
                                                style={{ marginTop: 12 }}
                                            >
                                                Histórico
                                            </h4>
                                            <ReadMore text={histPretty} />
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
}