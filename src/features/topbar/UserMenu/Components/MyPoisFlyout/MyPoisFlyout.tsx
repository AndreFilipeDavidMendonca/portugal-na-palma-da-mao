import "../shared/UserMenuFlyout.scss";
import Button from "@/components/Button/Button";

type MyPoiDto = {
  id: number;
  name: string;
  image: string | null;
};

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
    <div className="user-menu__flyout" role="region" aria-label="Os meus negócios">
      <div className="user-menu__flyout-header">
        <span>Os meus negócios</span>

        <Button
          type="button"
          className="user-menu__flyout-close"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar"
        >
          ×
        </Button>
      </div>

      <div className="user-menu__favorites gold-scroll">
        <Button
          type="button"
          className="user-menu__item user-menu__item--primary user-menu__item--full"
          onClick={() => {
            onClose();
            onCreatePoi();
          }}
        >
          + Adicionar negócio
        </Button>

        {loading && <div className="user-menu__hint">A carregar…</div>}
        {error && <div className="user-menu__error">{error}</div>}

        {!loading && !error && myPois.length === 0 && (
          <div className="user-menu__hint">Ainda não criaste negócios.</div>
        )}

        {!loading && !error && myPois.length > 0 && (
          <ul className="user-menu__fav-list">
            {myPois.map((poi) => {
              const hasImage = Boolean(poi.image);
              const busyDelete = busyDeletePoiIds.has(poi.id);

              return (
                <li key={poi.id} className="user-menu__fav-item">
                  <Button
                    type="button"
                    className="user-menu__fav-link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenPoi(poi.id);
                    }}
                    title={poi.name}
                  >
                    {hasImage && (
                      <span className="user-menu__fav-thumb">
                        <img src={poi.image!} alt={poi.name} />
                      </span>
                    )}

                    <span className="user-menu__fav-name">{poi.name}</span>
                  </Button>

                  <span
                    className={`user-menu__fav-x ${busyDelete ? "is-disabled" : ""}`}
                    role="button"
                    tabIndex={busyDelete ? -1 : 0}
                    title="Eliminar negócio"
                    aria-label="Eliminar negócio"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!busyDelete) onDeletePoi(poi.id, poi.name);
                    }}
                    onKeyDown={(e) => {
                      if (busyDelete) return;

                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onDeletePoi(poi.id, poi.name);
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