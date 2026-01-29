import type { FavoriteDto } from "@/lib/api";
import "./FavoritesFlyout.scss";

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
                                            onOpenPoi,
                                            onToggleFavorite,
                                        }: Props) {
    return (
        <div className="user-menu__flyout" role="region" aria-label="Favoritos">
            <div className="user-menu__flyout-header">
                <span>Favoritos</span>
                <button type="button" className="user-menu__flyout-close" onClick={onClose} aria-label="Fechar" title="Fechar">
                    ×
                </button>
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
                                    <button
                                        type="button"
                                        className="user-menu__fav-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onOpenPoi(f.poiId);
                                        }}
                                        title={f.name}
                                    >
                                        {hasImage && (
                                            <span className="user-menu__fav-thumb">
                        <img src={f.image!} alt={f.name} />
                      </span>
                                        )}
                                        <span className="user-menu__fav-name">{f.name}</span>
                                    </button>

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