// src/components/PoiComment/PoiComments.tsx
import React from "react";
import type { PoiCommentDto } from "@/lib/api";
import "./PoiComments.scss";

type Props = {
    user: any;

    comments: PoiCommentDto[];
    loading: boolean;

    body: string;
    setBody: (v: string) => void;

    sending: boolean;
    onAdd: () => void;
    onDelete: (id: number) => void;
};

export default function PoiComments({
                                        user,
                                        comments,
                                        loading,
                                        body,
                                        setBody,
                                        sending,
                                        onAdd,
                                        onDelete,
                                    }: Props) {
    return (
        <div className="poi-comments">
            <div className="poi-comments__head">
                <h3>Comentários</h3>
                {loading && <span className="poi-comments__mini">a carregar…</span>}
            </div>

            {/* composer só com login */}
            {user ? (
                <div className="poi-comments__composer">
          <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreve um comentário…"
              disabled={sending}
              rows={2}
          />
                    <button type="button" onClick={onAdd} disabled={sending || !body.trim()}>
                        {sending ? "A enviar…" : "Publicar"}
                    </button>
                </div>
            ) : (
                <div className="poi-comments__empty">Faz login para comentar.</div>
            )}

            <div className="poi-comments__list gold-scroll">
                {!loading && comments.length === 0 && (
                    <div className="poi-comments__empty">Ainda não há comentários.</div>
                )}

                {comments.map((c) => (
                    <div key={c.id} className="poi-comment">
                        <div className="poi-comment__top">
                            <div className="poi-comment__author">{c.authorName}</div>

                            <div className="poi-comment__meta">
                                <span className="poi-comment__date">{new Date(c.createdAt).toLocaleString()}</span>

                                {c.canDelete && (
                                    <span
                                        className="poi-comment__del"
                                        role="button"
                                        tabIndex={0}
                                        title="Remover comentário"
                                        onClick={() => onDelete(c.id)}
                                        onKeyDown={(e) => e.key === "Enter" && onDelete(c.id)}
                                    >
                    ×
                  </span>
                                )}
                            </div>
                        </div>

                        <div className="poi-comment__body">{c.body}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}