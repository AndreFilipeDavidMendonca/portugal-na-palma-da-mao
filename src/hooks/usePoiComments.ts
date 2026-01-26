import { useEffect, useState } from "react";
import { addPoiComment, deletePoiComment, fetchPoiComments, type PoiCommentDto } from "@/lib/api";

type Args = {
    open: boolean;
    poiId: number | null;
    user: any;
};

export default function usePoiComments({ open, poiId, user }: Args) {
    const [comments, setComments] = useState<PoiCommentDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);

    // load
    useEffect(() => {
        let alive = true;

        async function run() {
            if (!open || !poiId) {
                setComments([]);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const list = await fetchPoiComments(poiId);
                if (!alive) return;
                setComments(list ?? []);
            } catch (e: any) {
                if (!alive) return;
                setError(e?.message ?? "Falha ao carregar comentários.");
                setComments([]);
            } finally {
                if (alive) setLoading(false);
            }
        }

        run();
        return () => {
            alive = false;
        };
    }, [open, poiId]);

    const onAdd = async () => {
        if (!poiId || sending) return;

        const trimmed = body.trim();
        if (!trimmed) return;

        if (!user) return;

        setSending(true);
        setError(null);

        try {
            const created = await addPoiComment(poiId, trimmed);
            setComments((prev) => [created, ...prev]);
            setBody("");
        } catch (e: any) {
            setError(e?.message ?? "Falha ao enviar comentário.");
        } finally {
            setSending(false);
        }
    };

    const onDelete = async (commentId: number) => {
        if (sending) return;

        setSending(true);
        setError(null);

        try {
            await deletePoiComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
        } catch (e: any) {
            setError(e?.message ?? "Falha ao remover comentário.");
        } finally {
            setSending(false);
        }
    };

    return {
        user,
        comments,
        loading,
        error,
        body,
        setBody,
        sending,
        onAdd,
        onDelete,
    };
}