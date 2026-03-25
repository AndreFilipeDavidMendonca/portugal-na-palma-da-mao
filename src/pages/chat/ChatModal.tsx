import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button/Button";
import Input from "@/components/Input/TextField/Input";
import { toast } from "@/components/Toastr/toast";
import { useAuth } from "@/auth/AuthContext";
import { fetchChatMessages, sendChatMessage } from "@/lib/api";
import "./ChatModal.scss";

type ChatMessageDto = {
  id: string;
  senderId: string;
  senderDisplayName: string | null;
  body: string;
  createdAt: string;
};

type Props = {
  open: boolean;
  conversationId: string | null;
  friendName?: string | null;
  onClose: () => void;
};

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChatModal({
  open,
  conversationId,
  friendName,
  onClose,
}: Props) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const bodyRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(() => friendName?.trim() || "Chat", [friendName]);

  const scrollToBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(async () => {
    if (!open || !conversationId) return;

    setError(null);
    setLoading(true);

    try {
      const list = await fetchChatMessages(conversationId);
      setMessages(list ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Falha a carregar mensagens.");
    } finally {
      setLoading(false);
    }
  }, [open, conversationId]);

  useEffect(() => {
    if (!open || !conversationId) {
      setMessages([]);
      setDraft("");
      setError(null);
      setLoading(false);
      setSending(false);
      return;
    }

    loadMessages();
  }, [open, conversationId, loadMessages]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(scrollToBottom, 50);
    return () => window.clearTimeout(id);
  }, [open, messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!conversationId || !body || sending) return;

    setSending(true);
    setError(null);

    try {
      await sendChatMessage(conversationId, body);

      const optimistic: ChatMessageDto = {
        id: `tmp-${Date.now()}`,
        senderId: String(user?.id ?? ""),
        senderDisplayName: user?.displayName ?? null,
        body,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimistic]);
      setDraft("");

      window.setTimeout(() => {
        loadMessages().catch(() => null);
      }, 120);
    } catch (err: any) {
      const message = err?.message ?? "Falha ao enviar mensagem.";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, sending, user?.id, user?.displayName, loadMessages]);

  if (!open || !conversationId) return null;

  return (
    <div className="chat-modal__overlay" onClick={onClose}>
      <div
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Chat com ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat-modal__header">
          <div className="chat-modal__header-main">
            <div className="chat-modal__title">{title}</div>
            <div className="chat-modal__subtitle">Conversa privada</div>
          </div>

          <Button
            type="button"
            className="chat-modal__close"
            onClick={onClose}
            aria-label="Fechar chat"
            title="Fechar chat"
          >
            ×
          </Button>
        </div>

        <div className="chat-modal__messages gold-scroll" ref={bodyRef}>
          {loading && <div className="chat-modal__state">A carregar mensagens…</div>}
          {error && !loading && <div className="chat-modal__error">{error}</div>}

          {!loading && !error && messages.length === 0 && (
            <div className="chat-modal__state">Ainda não existem mensagens.</div>
          )}

          {!loading &&
            !error &&
            messages.map((message) => {
              const mine = String(message.senderId) === String(user?.id);

              return (
                <div
                  key={message.id}
                  className={`chat-modal__message ${mine ? "is-mine" : "is-theirs"}`}
                >
                  {!mine && (
                    <div className="chat-modal__message-author">
                      {message.senderDisplayName || title}
                    </div>
                  )}

                  <div className="chat-modal__bubble">
                    <div className="chat-modal__bubble-text">{message.body}</div>
                    <div className="chat-modal__bubble-time">
                      {formatTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="chat-modal__composer">
          <div className="chat-modal__composer-input">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreve uma mensagem…"
              disabled={sending}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>

          <Button
            type="button"
            className="chat-modal__send"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label="Enviar mensagem"
            title="Enviar mensagem"
          >
            ↑
          </Button>
        </div>
      </div>
    </div>
  );
}