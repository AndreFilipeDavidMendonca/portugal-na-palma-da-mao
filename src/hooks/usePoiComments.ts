// src/hooks/usePoiComments.ts
import { useEffect, useState } from "react";
import { addPoiComment, deletePoiComment, fetchPoiComments, type PoiCommentDto } from "@/lib/api";
import { toast } from "@/components/Toastr/toast";

type Args = {
    open: boolean;
    poiId: number | null;
    user: any;
};

export default function usePoiComments({ open, poiId, user }: Args) {
    const [comments, setComments] = useState<PoiCommentDto[]>([]);
    const [loading, setLoading] = useState(false);

    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        let alive = true;

        async function run() {
            if (!open || !poiId) {
                setComments([]);
                return;
            }

            setLoading(true);

            try {
                const list = await fetchPoiComments(poiId);
                if (!alive) return;
                setComments(list ?? []);
            } catch (e: any) {
                if (!alive) return;
                setComments([]);
                toast.error(e?.message ?? "Falha ao carregar comentários.");
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

        if (!user) {
            toast.info("Faz login para comentar.");
            return;
        }

        setSending(true);

        try {
            const created = await addPoiComment(poiId, trimmed);
            setComments((prev) => [created, ...prev]);
            setBody("");
            toast.success("Comentário publicado.");
        } catch (e: any) {
            toast.error(e?.message ?? "Falha ao enviar comentário.");
        } finally {
            setSending(false);
        }
    };

    const onDelete = async (commentId: number) => {
        if (sending) return;

        setSending(true);

        try {
            await deletePoiComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            toast.success("Comentário removido.");
        } catch (e: any) {
            toast.error(e?.message ?? "Falha ao remover comentário.");
        } finally {
            setSending(false);
        }
    };

    return {
        user,
        comments,
        loading,
        body,
        setBody,
        sending,
        onAdd,
        onDelete,
    };
}