import "../shared/UserMenuFlyout.scss";
import "./NotificationsFlyout.scss";
import Button from "@/components/Button/Button";
import type { FriendRequestResponseDto } from "@/lib/api";

type Props = {
  loading?: boolean;
  error?: string | null;
  notifications?: FriendRequestResponseDto[];
  busyIds?: Set<string>;
  onClose: () => void;
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildDisplayName(notification: FriendRequestResponseDto) {
  const raw = notification.requesterDisplayName?.trim();
  if (raw) return raw;
  return "Utilizador";
}

export default function NotificationsFlyout({
  loading = false,
  error = null,
  notifications = [],
  busyIds = new Set<string>(),
  onClose,
  onAccept,
  onReject,
}: Props) {
  return (
    <div className="notifications-flyout user-menu__flyout" role="region" aria-label="Convites">
      <div className="user-menu__flyout-header notifications-flyout__header">
        <span className="notifications-flyout__title">Convites</span>

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

      <div className="notifications-flyout__body gold-scroll">
        {loading && <div className="notifications-flyout__hint">A carregar convites…</div>}

        {error && !loading && <div className="notifications-flyout__error">{error}</div>}

        {!loading && !error && notifications.length === 0 && (
          <div className="notifications-flyout__hint">Não tens convites pendentes.</div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <ul className="notifications-flyout__list">
            {notifications.map((notification) => {
              const busy = busyIds.has(notification.id);
              const displayName = buildDisplayName(notification);
              const formattedDate = formatDate(notification.createdAt);

              return (
                <li key={notification.id} className="notifications-flyout__item">
                  <div className="notifications-flyout__main">
                    <div className="notifications-flyout__title-row">
                      <span className="notifications-flyout__name">{displayName}</span>

                      {formattedDate && (
                        <span className="notifications-flyout__date">{formattedDate}</span>
                      )}
                    </div>

                    <div className="notifications-flyout__email">
                      {notification.requesterEmail}
                    </div>
                  </div>

                  <div className="notifications-flyout__actions">
                    <Button
                      type="button"
                      className="notifications-flyout__icon-btn notifications-flyout__icon-btn--accept"
                      disabled={busy}
                      onClick={() => onAccept(notification.id)}
                      aria-label="Aceitar convite"
                      title="Aceitar"
                      variant="gold"
                    >
                      ✓
                    </Button>

                    <Button
                      type="button"
                      className="notifications-flyout__icon-btn notifications-flyout__icon-btn--reject"
                      disabled={busy}
                      onClick={() => onReject(notification.id)}
                      aria-label="Rejeitar convite"
                      title="Rejeitar"
                    >
                      ×
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}