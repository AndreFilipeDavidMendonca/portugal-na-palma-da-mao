import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import Button from "@/components/Button/Button";
import { toast } from "@/components/Toastr/toast";
import {
  fetchFriends,
  sendChatMessage,
  startChat,
  type FriendDto,
  type SendChatMessagePayload,
} from "@/lib/api";
import "./SharePoiToFriendModal.scss";

type PoiSharePayload = {
  poiId: number;
  poiName: string;
  poiImage?: string | null;
};

type Props = {
  open: boolean;
  poi: PoiSharePayload | null;
  onClose: () => void;
};

function getInitial(value?: string | null) {
  const text = value?.trim();
  return text ? text.charAt(0).toUpperCase() : "?";
}

export default function SharePoiToFriendModal({ open, poi, onClose }: Props) {
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  const title = useMemo(() => poi?.poiName?.trim() || "este POI", [poi?.poiName]);

  const loadFriends = useCallback(async () => {
    if (!open) return;

    setLoading(true);
    setError(null);

    try {
      const list = await fetchFriends();
      setFriends(list ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Falha a carregar amigos.");
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFriends([]);
      setError(null);
      setLoading(false);
      setSendingUserId(null);
      return;
    }

    loadFriends().catch(() => null);
  }, [open, loadFriends]);

  const handleShare = useCallback(
    async (friend: FriendDto) => {
      if (!poi || sendingUserId) return;

      setSendingUserId(friend.id);
      setError(null);

      const payload: SendChatMessagePayload = {
        type: "POI_SHARE",
        poiId: poi.poiId,
        poiName: poi.poiName,
        poiImage: poi.poiImage ?? null,
      };

      try {
        const { conversationId } = await startChat(friend.id);
        await sendChatMessage(conversationId, payload);
        toast.success(`POI enviado para ${friend.displayName || friend.email}.`);
        onClose();
      } catch (err: any) {
        const message = err?.message ?? "Não foi possível partilhar este POI.";
        setError(message);
        toast.error(message);
      } finally {
        setSendingUserId(null);
      }
    },
    [onClose, poi, sendingUserId]
  );

  if (!open || !poi) return null;

  return ReactDOM.createPortal(
    <div className="share-poi-modal__overlay" onClick={onClose}>
      <div
        className="share-poi-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Partilhar ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-poi-modal__header">
          <div className="share-poi-modal__eyebrow">Partilhar POI</div>
          <div className="share-poi-modal__title" title={title}>
            {title}
          </div>
          <Button
            type="button"
            className="share-poi-modal__close"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
          >
            ×
          </Button>
        </div>

        <div className="share-poi-modal__body gold-scroll">
          {loading && <div className="share-poi-modal__state">A carregar amigos…</div>}
          {error && !loading && <div className="share-poi-modal__error">{error}</div>}

          {!loading && !error && friends.length === 0 && (
            <div className="share-poi-modal__state">Ainda não tens amigos para partilhar.</div>
          )}

          {!loading && !error && friends.length > 0 && (
            <ul className="share-poi-modal__list">
              {friends.map((friend) => {
                const isSending = sendingUserId === friend.id;
                return (
                  <li key={friend.id} className="share-poi-modal__item">
                    <button
                      type="button"
                      className="share-poi-modal__friend"
                      onClick={() => handleShare(friend)}
                      disabled={Boolean(sendingUserId)}
                    >
                      {friend.avatarUrl ? (
                        <span className="share-poi-modal__avatar">
                          <img src={friend.avatarUrl} alt={friend.displayName || friend.email} />
                        </span>
                      ) : (
                        <span className="share-poi-modal__avatar share-poi-modal__avatar--empty">
                          {getInitial(friend.displayName || friend.email)}
                        </span>
                      )}

                      <span className="share-poi-modal__meta">
                        <span className="share-poi-modal__name">
                          {friend.displayName || friend.email}
                        </span>
                        <span className="share-poi-modal__email">{friend.email}</span>
                      </span>

                      <span className="share-poi-modal__cta">
                        {isSending ? "A enviar…" : "Enviar"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
