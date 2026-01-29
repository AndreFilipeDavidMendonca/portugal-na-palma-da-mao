import "./MyPoisFlyout.scss";

type MyPoiDto = { id: number; name: string; image: string | null };

type Props = {
    loading: boolean;
    error: string | null;
    myPois: MyPoiDto[];
    busyDeletePoiIds: Set<number>;
    onClose: () => void;
    onCreatePoi: () => void;
    onOpenPoi: (poiId: number) => void;
    onDeletePoi: (poiId: number, poiName?: string) => void;
};

export default function MyPoisFlyout({
                                         loading,
                                         error,
                                         myPois,
                                         busyDeletePoiIds,
                                         onClose,
                                         onCreatePoi,
                                         onOpenPoi,
                                         onDeletePoi,
                                     }: Props) {
    return (
        <div className="user-menu__flyout" role="region" aria-label="Os meus POIs">
            <div className="user-menu__flyout-header">
                <span>Os meus POIs</span>
                <button type="button" className="user-menu__flyout-close" onClick={onClose} aria-label="Fechar" title="Fechar">
                    ×
                </button>
            </div>

            <div className="user-menu__favorites">
                <button type="button" className="user-menu__item user-menu__item--primary user-menu__item--full" onClick={onCreatePoi}>
                    + Criar POI
                </button>

                {loading && <div className="user-menu__hint">A carregar…</div>}
                {error && <div className="user-menu__error">{error}</div>}

                {!loading && !error && myPois.length === 0 && (
                    <div className="user-menu__hint">Ainda não criaste POIs.</div>
                )}

                {!loading && !error && myPois.length > 0 && (
                    <ul className="user-menu__fav-list">
                        {myPois.map((p) => {
                            const hasImage = Boolean(p.image);
                            const busyDel = busyDeletePoiIds.has(p.id);

                            return (
                                <li key={p.id} className="user-menu__fav-item">
                                    <button
                                        type="button"
                                        className="user-menu__fav-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onOpenPoi(p.id);
                                        }}
                                        title={p.name}
                                    >
                                        {hasImage && (
                                            <span className="user-menu__fav-thumb">
                        <img src={p.image!} alt={p.name} />
                      </span>
                                        )}
                                        <span className="user-menu__fav-name">{p.name}</span>
                                    </button>

                                    <span
                                        className={`user-menu__fav-x ${busyDel ? "is-disabled" : ""}`}
                                        role="button"
                                        tabIndex={busyDel ? -1 : 0}
                                        title="Eliminar POI"
                                        aria-label="Eliminar POI"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!busyDel) onDeletePoi(p.id, p.name);
                                        }}
                                        onKeyDown={(e) => {
                                            if (busyDel) return;
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                onDeletePoi(p.id, p.name);
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