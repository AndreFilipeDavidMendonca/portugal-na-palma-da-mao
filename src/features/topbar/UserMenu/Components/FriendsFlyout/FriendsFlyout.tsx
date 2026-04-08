import { useMemo, useState } from "react";
import "../shared/UserMenuFlyout.scss";
import "./FriendsFlyout.scss";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";
import { toast } from "@/components/Toastr/toast";

type FriendDto = {
  id: string;
  friendshipId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  unreadMessagesCount?: number;
  hasUnreadMessages?: boolean;
};

type Props = {
  loading: boolean;
  error: string | null;
  friends: FriendDto[];
  sendingInvite: boolean;
  busyFriendshipIds: Set<string>;
  busyChatUserIds: Set<string>;
  onClose: () => void;
  onSendInvite: (email: string) => Promise<void> | void;
  onDeleteFriendship: (friendshipId: string, friendName?: string) => Promise<void> | void;
  onStartChat: (friendUserId: string) => Promise<void> | void;
};

function isEmailLike(value: string) {
  const s = value.trim();
  return s.includes("@") && s.includes(".") && s.length >= 5;
}

function getInitial(value?: string | null) {
  const v = value?.trim();
  return v ? v.charAt(0).toUpperCase() : "?";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export default function FriendsFlyout({
  loading,
  error,
  friends,
  sendingInvite,
  busyFriendshipIds,
  busyChatUserIds,
  onClose,
  onSendInvite,
  onDeleteFriendship,
  onStartChat,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");

  const canSubmit = useMemo(
    () => isEmailLike(email) && !sendingInvite,
    [email, sendingInvite]
  );

  async function handleSubmit() {
    const next = email.trim().toLowerCase();

    if (!next) {
      toast.error("Escreve um email.");
      return;
    }

    if (!isEmailLike(next)) {
      toast.error("Introduz um email válido.");
      return;
    }

    if (sendingInvite) return;

    try {
      await onSendInvite(next);
      toast.success("Convite enviado.");
      setEmail("");
      setAdding(false);
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          "Não foi possível enviar o convite. Tenta novamente dentro de alguns segundos."
        )
      );
    }
  }

  async function handleDelete(friendshipId: string, friendName?: string) {
    try {
      await onDeleteFriendship(friendshipId, friendName);
      toast.success("Amizade removida.");
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          "Não foi possível remover esta amizade. Tenta novamente dentro de alguns segundos."
        )
      );
    }
  }

  async function handleStartChat(friendUserId: string) {
    try {
      await onStartChat(friendUserId);
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          "Não foi possível abrir o chat. Tenta novamente dentro de alguns segundos."
        )
      );
    }
  }

  return (
    <div className="friends-flyout user-menu__flyout" role="region" aria-label="Amigos">
      <div className="user-menu__flyout-header friends-flyout__header">
        <span className="friends-flyout__title">Amigos</span>

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

      <div className="friends-flyout__body gold-scroll">
        {!adding ? (
          <Button
            type="button"
            className="user-menu__item user-menu__item--primary user-menu__item--full friends-flyout__add-btn"
            onClick={() => setAdding(true)}
          >
            + Adicionar amigo
          </Button>
        ) : (
          <div className="friends-flyout__add-panel">
            <Input
              placeholder="Email do amigo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sendingInvite}
              type="email"
              autoComplete="email"
            />

            <div className="friends-flyout__add-actions">
              <Button
                type="button"
                variant="ghost"
                pill
                strong
                onClick={() => {
                  setAdding(false);
                  setEmail("");
                }}
                disabled={sendingInvite}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="primary"
                pill
                strong
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {sendingInvite ? "A enviar…" : "Enviar convite"}
              </Button>
            </div>
          </div>
        )}

        {loading && <div className="friends-flyout__hint">A carregar…</div>}

        {!loading && error && <div className="friends-flyout__error">{error}</div>}

        {!loading && !error && friends.length === 0 && (
          <div className="friends-flyout__hint">Ainda não tens amigos adicionados.</div>
        )}

        {!loading && friends.length > 0 && (
          <ul className="friends-flyout__list">
            {friends.map((friend) => {
              const busyDelete = busyFriendshipIds.has(friend.friendshipId);
              const busyChat = busyChatUserIds.has(friend.id);
              const hasUnread =
                (friend.unreadMessagesCount ?? 0) > 0 || Boolean(friend.hasUnreadMessages);

              return (
                <li key={friend.friendshipId} className="friends-flyout__item">
                  <div className="friends-flyout__main">
                    <div className="friends-flyout__identity">
                      {friend.avatarUrl ? (
                        <span className="friends-flyout__thumb">
                          <img
                            src={friend.avatarUrl}
                            alt={friend.displayName || friend.email}
                          />
                        </span>
                      ) : (
                        <span className="friends-flyout__thumb friends-flyout__thumb--empty">
                          {getInitial(friend.displayName || friend.email)}
                        </span>
                      )}

                      <div className="friends-flyout__meta">
                        <div className="friends-flyout__name">
                          {friend.displayName || friend.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="friends-flyout__actions">
                    <div className="friends-flyout__chat-wrap">
                      {hasUnread && (
                        <span
                          className="friends-flyout__chat-alert"
                          aria-label="Novas mensagens"
                          title="Novas mensagens"
                        >
                          !
                        </span>
                      )}

                      <Button
                        type="button"
                        className="friends-flyout__icon-btn friends-flyout__icon-btn--chat"
                        disabled={busyChat}
                        onClick={() => handleStartChat(friend.id)}
                        aria-label="Abrir chat"
                        title="Abrir chat"
                      >
                        💬
                      </Button>
                    </div>

                    <Button
                      type="button"
                      className="friends-flyout__icon-btn friends-flyout__icon-btn--delete"
                      disabled={busyDelete}
                      onClick={() =>
                        handleDelete(friend.friendshipId, friend.displayName || friend.email)
                      }
                      aria-label="Eliminar amizade"
                      title="Eliminar amizade"
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