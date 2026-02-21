import type { FavoriteDto } from "@/lib/api";
import "../shared/UserMenuFlyout.scss";
import Button from "@/components/Button/Button";

type Props = {
    loading: boolean;
    error: string | null;
    favorites: FavoriteDto[];
    busyPoiIds: Set<number>;
    onClose: () => void;
    onOpenPoi: (poiId: number) => void;
    onToggleFavorite: (poiId: number) => void;
};

export default function FavoritesFlyout({
                                            loading,
                                            error,
                                            favorites,
                                            busyPoiIds,
                                            onClose,

                                            onToggleFavorite,
                                        }: Props) {

    return (
        <div className="user-menu__flyout" role="region" aria-label="Favoritos">
            <div className="user-menu__flyout-header">
                <span>Favoritos</span>
                <Button type="button" className="user-menu__flyout-close" onClick={onClose} aria-label="Fechar" title="Fechar">
                    ×
                </Button>
            </div>

            <div className="user-menu__favorites">
                {loading && <div className="user-menu__hint">A carregar…</div>}
                {error && <div className="user-menu__error">{error}</div>}

                {!loading && !error && favorites.length === 0 && (
                    <div className="user-menu__hint">Ainda não tens favoritos.</div>
                )}

                {!loading && !error && favorites.length > 0 && (
                    <ul className="user-menu__fav-list">
                        {favorites.map((f) => {
                            const busy = busyPoiIds.has(f.poiId);
                            const hasImage = Boolean(f.image);

                            return (
                                <li key={f.poiId} className="user-menu__fav-item">
                                    <Button
                                        type="button"
                                        className="user-menu__fav-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onClose();
                                            window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId: f.poiId } }));
                                        }}
                                        title={f.name}
                                    >
                                        {hasImage && (
                                            <span className="user-menu__fav-thumb">
            <img src={f.image!} alt={f.name} />
          </span>
                                        )}
                                        <span className="user-menu__fav-name">{f.name}</span>
                                    </Button>

                                    <span
                                        className={`user-menu__fav-x ${busy ? "is-disabled" : ""}`}
                                        role="button"
                                        tabIndex={busy ? -1 : 0}
                                        title="Remover dos favoritos"
                                        aria-label="Remover dos favoritos"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!busy) onToggleFavorite(f.poiId);
                                        }}
                                        onKeyDown={(e) => {
                                            if (busy) return;
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                onToggleFavorite(f.poiId);
                                            }
                                        }}
                                    >
                                        ×
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}