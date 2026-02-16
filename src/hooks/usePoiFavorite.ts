import { useEffect, useState } from "react";
import { addFavorite, fetchFavoriteStatus, removeFavorite } from "@/lib/api";
import {toast} from "@/components/Toastr/toast";

type Args = {
    open: boolean;
    poiId: number | null;
    user: any;
};

export default function usePoiFavorite({ open, poiId, user }: Args) {
    const [favLoading, setFavLoading] = useState(false);
    const [isFav, setIsFav] = useState(false);

    useEffect(() => {
        let alive = true;

        async function run() {
            if (!open || !poiId || !user) {
                setIsFav(false);
                return;
            }

            setFavLoading(true);
            try {
                const fav = await fetchFavoriteStatus(poiId);
                if (!alive) return;
                setIsFav(Boolean(fav?.favorited));
            } catch {
                if (!alive) return;
                setIsFav(false);
            } finally {
                if (alive) setFavLoading(false);
            }
        }

        run();
        return () => {
            alive = false;
        };
    }, [open, poiId, user]);

    const toggleFavorite = async () => {
        if (!poiId || favLoading) return;

        if (!user) {
            toast.info("Para adicionares aos favoritos, tens de te registar / fazer login.");
            return;
        }

        setFavLoading(true);
        try {
            if (isFav) {
                await removeFavorite(poiId);
                setIsFav(false);
            } else {
                await addFavorite(poiId);
                setIsFav(true);
            }
        } catch (e: any) {
            toast.error(e?.message ?? "Falha ao atualizar favoritos.");
        } finally {
            setFavLoading(false);
        }
    };

    return { isFav, favLoading, toggleFavorite };
}