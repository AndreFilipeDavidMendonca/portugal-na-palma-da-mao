import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/auth/AuthContext";
import {
  addFavorite,
  deletePoiById,
  fetchFavorites,
  fetchMyPois,
  fetchFriends,
  fetchPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  deleteFriendship,
  startChat,
  logout,
  removeFavorite,
  type FavoriteDto,
  type FriendDto,
  type FriendRequestResponseDto,
} from "@/lib/api";

import UserMenuButton from "./Components/UserMenuButton/UserMenuButton";
import UserMenuDropdown, {
  type UserMenuPanel,
} from "./Components/UserMenuDropdown/UserMenuDropdown";
import FavoritesFlyout from "./Components/FavoritesFlyout/FavoritesFlyout";
import MyPoisFlyout from "./Components/MyPoisFlyout/MyPoisFlyout";
import FriendsFlyout from "./Components/FriendsFlyout/FriendsFlyout";
import NotificationsFlyout from "./Components/NotificationsFlyout/NotificationsFlyout";
import ChatModal from "@/pages/chat/ChatModal";
import "./UserMenu.scss";
import { toast } from "@/components/Toastr/toast";

type MyPoiDto = {
  id: number;
  name: string;
  image: string | null;
};

const createEmptySet = () => new Set<number>();

function emitOpenLogin() {
  window.dispatchEvent(new Event("pt:open-login"));
}

function emitOpenProfile() {
  window.dispatchEvent(new Event("pt:open-profile"));
}

function emitOpenPoi(poiId: number) {
  window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId } }));
}

function emitOpenCreatePoi() {
  window.dispatchEvent(new Event("pt:open-create-poi"));
}

export default function UserMenu() {
  const { user, setUser, refreshUser } = useAuth();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<UserMenuPanel>(null);

  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [favError, setFavError] = useState<string | null>(null);
  const [busyPoiIds, setBusyPoiIds] = useState<Set<number>>(createEmptySet);

  const [myPois, setMyPois] = useState<MyPoiDto[]>([]);
  const [myPoisLoading, setMyPoisLoading] = useState(false);
  const [myPoisError, setMyPoisError] = useState<string | null>(null);
  const [busyDeletePoiIds, setBusyDeletePoiIds] = useState<Set<number>>(createEmptySet);

  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<FriendRequestResponseDto[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [busyPendingIds, setBusyPendingIds] = useState<Set<string>>(new Set());
  const [busyFriendshipIds, setBusyFriendshipIds] = useState<Set<string>>(new Set());
  const [busyChatUserIds, setBusyChatUserIds] = useState<Set<string>>(new Set());

  const [chatOpen, setChatOpen] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatFriendName, setChatFriendName] = useState<string | null>(null);

  const isBusiness = useMemo(
    () => user?.role === "BUSINESS" || user?.role === "ADMIN",
    [user?.role]
  );

  const closeAll = useCallback(() => {
    setOpen(false);
    setOpenPanel(null);
  }, []);

  const resetPanels = useCallback(() => {
    setOpenPanel(null);

    setFavorites([]);
    setMyPois([]);
    setFriends([]);
    setPendingRequests([]);

    setBusyPoiIds(createEmptySet);
    setBusyDeletePoiIds(createEmptySet);
    setBusyPendingIds(new Set());
    setBusyFriendshipIds(new Set());
    setBusyChatUserIds(new Set());

    setFavError(null);
    setMyPoisError(null);
    setFriendsError(null);
    setPendingError(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) {
        closeAll();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeAll]);

  useEffect(() => {
    if (user) return;
    resetPanels();
  }, [user, resetPanels]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;

    setFavError(null);
    setFavLoading(true);

    try {
      const list = await fetchFavorites();
      setFavorites(list ?? []);
    } catch (err: any) {
      setFavError(err?.message ?? "Falha a carregar favoritos");
    } finally {
      setFavLoading(false);
    }
  }, [user]);

  const loadMyPois = useCallback(async () => {
    if (!user || !isBusiness) return;

    setMyPoisError(null);
    setMyPoisLoading(true);

    try {
      const list = await fetchMyPois();
      setMyPois(list ?? []);
    } catch (err: any) {
      setMyPoisError(err?.message ?? "Falha a carregar os meus negócios");
    } finally {
      setMyPoisLoading(false);
    }
  }, [user, isBusiness]);

  const loadFriends = useCallback(async () => {
    if (!user) return;

    setFriendsError(null);
    setFriendsLoading(true);

    try {
      const list = await fetchFriends();
      setFriends(list ?? []);
    } catch (err: any) {
      setFriendsError(err?.message ?? "Falha a carregar amigos");
    } finally {
      setFriendsLoading(false);
    }
  }, [user]);

  const loadPendingRequests = useCallback(async () => {
    if (!user) return;

    setPendingError(null);
    setPendingLoading(true);

    try {
      const list = await fetchPendingFriendRequests();
      setPendingRequests(list ?? []);
    } catch (err: any) {
      setPendingError(err?.message ?? "Falha a carregar convites");
    } finally {
      setPendingLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;

    loadFavorites();

    if (isBusiness) {
      loadMyPois();
    }

    loadFriends();
    loadPendingRequests();
  }, [open, user, isBusiness, loadFavorites, loadMyPois, loadFriends, loadPendingRequests]);

  useEffect(() => {
    function handleOpenChat(event: Event) {
      const custom = event as CustomEvent<{
        conversationId: string;
        friendUserId?: string;
        friendName?: string;
      }>;

      setChatConversationId(custom.detail?.conversationId ?? null);
      setChatFriendName(custom.detail?.friendName ?? "Chat");
      setChatOpen(true);
    }

    window.addEventListener("pt:open-chat", handleOpenChat);
    return () => window.removeEventListener("pt:open-chat", handleOpenChat);
  }, []);

  const handleLogin = useCallback(() => {
    closeAll();
    emitOpenLogin();
  }, [closeAll]);

  const handleEditProfile = useCallback(() => {
    closeAll();
    emitOpenProfile();
  }, [closeAll]);

  const handleLogout = useCallback(async () => {
    closeAll();
    await logout().catch(() => null);
    setUser(null);
    await refreshUser().catch(() => null);
  }, [closeAll, refreshUser, setUser]);

  const handleOpenPoi = useCallback(
    (poiId: number) => {
      closeAll();
      emitOpenPoi(poiId);
    },
    [closeAll]
  );

  const handleCreatePoi = useCallback(() => {
    closeAll();
    emitOpenCreatePoi();
  }, [closeAll]);

  const handleTogglePanel = useCallback((panel: Exclude<UserMenuPanel, null>) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleSendInvite = useCallback(
    async (email: string) => {
      if (!user || sendingInvite) {
        throw new Error("Sessão inválida.");
      }

      setFriendsError(null);
      setSendingInvite(true);

      try {
        await sendFriendRequest(email);
        await loadFriends();
        await loadPendingRequests();
      } catch (err: any) {
        const message = err?.message ?? "Falha ao enviar convite";
        setFriendsError(message);
        throw err;
      } finally {
        setSendingInvite(false);
      }
    },
    [user, sendingInvite, loadFriends, loadPendingRequests]
  );

  const handleAcceptRequest = useCallback(
    async (friendshipId: string) => {
      if (!user || busyPendingIds.has(friendshipId)) return;

      setPendingError(null);
      setBusyPendingIds((prev) => new Set(prev).add(friendshipId));

      try {
        await acceptFriendRequest(friendshipId);
        toast.success("Convite aceite com sucesso.");

        setPendingRequests((prev) => prev.filter((item) => item.id !== friendshipId));
        await loadFriends();
      } catch (err: any) {
        const message = err?.message ?? "Falha ao aceitar convite";
        setPendingError(message);
        toast.error(message);
      } finally {
        setBusyPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(friendshipId);
          return next;
        });
      }
    },
    [user, busyPendingIds, loadFriends]
  );

  const handleRejectRequest = useCallback(
    async (friendshipId: string) => {
      if (!user || busyPendingIds.has(friendshipId)) return;

      setPendingError(null);
      setBusyPendingIds((prev) => new Set(prev).add(friendshipId));

      try {
        await rejectFriendRequest(friendshipId);
        toast.success("Convite rejeitado.");

        setPendingRequests((prev) => prev.filter((item) => item.id !== friendshipId));
      } catch (err: any) {
        const message = err?.message ?? "Falha ao rejeitar convite";
        setPendingError(message);
        toast.error(message);
      } finally {
        setBusyPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(friendshipId);
          return next;
        });
      }
    },
    [user, busyPendingIds]
  );

  const handleToggleFavorite = useCallback(
    async (poiId: number) => {
      if (!user || busyPoiIds.has(poiId)) return;

      setFavError(null);
      setBusyPoiIds((prev) => new Set(prev).add(poiId));

      const alreadyFavorite = favorites.some((favorite) => favorite.poiId === poiId);

      try {
        if (alreadyFavorite) {
          await removeFavorite(poiId);
          setFavorites((prev) => prev.filter((favorite) => favorite.poiId !== poiId));
        } else {
          await addFavorite(poiId);
          await loadFavorites();
        }
      } catch (err: any) {
        setFavError(err?.message ?? "Falha a atualizar favorito");
      } finally {
        setBusyPoiIds((prev) => {
          const next = new Set(prev);
          next.delete(poiId);
          return next;
        });
      }
    },
    [user, busyPoiIds, favorites, loadFavorites]
  );

  const handleDeletePoi = useCallback(
    async (poiId: number, poiName?: string) => {
      if (!user || busyDeletePoiIds.has(poiId)) return;

      const confirmed = window.confirm(
        `Tens a certeza que queres eliminar este negócio${poiName ? ` (“${poiName}”)` : ""}?`
      );

      if (!confirmed) return;

      setMyPoisError(null);
      setBusyDeletePoiIds((prev) => new Set(prev).add(poiId));

      try {
        await deletePoiById(poiId);
        setMyPois((prev) => prev.filter((poi) => poi.id !== poiId));
      } catch (err: any) {
        setMyPoisError(err?.message ?? "Falha ao eliminar negócio");
      } finally {
        setBusyDeletePoiIds((prev) => {
          const next = new Set(prev);
          next.delete(poiId);
          return next;
        });
      }
    },
    [user, busyDeletePoiIds]
  );

  const handleDeleteFriendship = useCallback(
    async (friendshipId: string, friendName?: string) => {
      if (!user || busyFriendshipIds.has(friendshipId)) return;

      const confirmed = window.confirm(
        `Tens a certeza que queres eliminar esta amizade${
          friendName ? ` com “${friendName}”` : ""
        }?`
      );

      if (!confirmed) return;

      setFriendsError(null);
      setBusyFriendshipIds((prev) => new Set(prev).add(friendshipId));

      try {
        await deleteFriendship(friendshipId);
        setFriends((prev) => prev.filter((friend) => friend.friendshipId !== friendshipId));
        toast.success("Amizade eliminada.");
      } catch (err: any) {
        const message = err?.message ?? "Falha ao eliminar amizade";
        setFriendsError(message);
        toast.error(message);
      } finally {
        setBusyFriendshipIds((prev) => {
          const next = new Set(prev);
          next.delete(friendshipId);
          return next;
        });
      }
    },
    [user, busyFriendshipIds]
  );

  const handleStartChat = useCallback(
    async (friendUserId: string) => {
      if (!user || busyChatUserIds.has(friendUserId)) return;

      setFriendsError(null);
      setBusyChatUserIds((prev) => new Set(prev).add(friendUserId));

      try {
        const { conversationId } = await startChat(friendUserId);
        const friend = friends.find((f) => f.id === friendUserId);

        window.dispatchEvent(
          new CustomEvent("pt:open-chat", {
            detail: {
              conversationId,
              friendUserId,
              friendName: friend?.displayName || friend?.email || "Chat",
            },
          })
        );
        closeAll();
      } catch (err: any) {
        const message = err?.message ?? "Falha ao iniciar chat";
        setFriendsError(message);
        toast.error(message);
      } finally {
        setBusyChatUserIds((prev) => {
          const next = new Set(prev);
          next.delete(friendUserId);
          return next;
        });
      }
    },
    [user, busyChatUserIds, closeAll, friends]
  );

  return (
    <div className="user-menu gold-scroll" ref={wrapRef}>
      <UserMenuButton
        email={user?.email ?? null}
        isOpen={open}
        onToggle={() => setOpen((prev) => !prev)}
      />

     {open && (
       <>
         {openPanel === null && (
           <UserMenuDropdown
             user={user}
             isBusiness={isBusiness}
             openPanel={openPanel}
             pendingCount={pendingRequests.length}
             unreadFriendsMessagesCount={friends.reduce(
               (sum, friend) => sum + (friend.unreadMessagesCount ?? 0),
               0
             )}
             onTogglePanel={handleTogglePanel}
             onEditProfile={handleEditProfile}
             onLogout={handleLogout}
             onLogin={handleLogin}
           />
         )}

         {user && openPanel === "notifications" && (
           <NotificationsFlyout
             loading={pendingLoading}
             error={pendingError}
             notifications={pendingRequests}
             busyIds={busyPendingIds}
             onClose={() => setOpenPanel(null)}
             onAccept={handleAcceptRequest}
             onReject={handleRejectRequest}
           />
         )}

         {user && openPanel === "friends" && (
           <FriendsFlyout
             loading={friendsLoading}
             error={friendsError}
             friends={friends}
             sendingInvite={sendingInvite}
             busyFriendshipIds={busyFriendshipIds}
             busyChatUserIds={busyChatUserIds}
             onClose={() => setOpenPanel(null)}
             onSendInvite={handleSendInvite}
             onDeleteFriendship={handleDeleteFriendship}
             onStartChat={handleStartChat}
           />
         )}

         {user && openPanel === "favorites" && (
           <FavoritesFlyout
             loading={favLoading}
             error={favError}
             favorites={favorites}
             busyPoiIds={busyPoiIds}
             onClose={() => setOpenPanel(null)}
             onOpenPoi={handleOpenPoi}
             onToggleFavorite={handleToggleFavorite}
           />
         )}

         {user && isBusiness && openPanel === "myPois" && (
           <MyPoisFlyout
             loading={myPoisLoading}
             error={myPoisError}
             myPois={myPois}
             busyDeletePoiIds={busyDeletePoiIds}
             onClose={() => setOpenPanel(null)}
             onCreatePoi={handleCreatePoi}
             onOpenPoi={handleOpenPoi}
             onDeletePoi={handleDeletePoi}
           />
         )}
       </>
     )}

      <ChatModal
        open={chatOpen}
        conversationId={chatConversationId}
        friendName={chatFriendName}
        onClose={() => {
          setChatOpen(false);
          setChatConversationId(null);
          setChatFriendName(null);
        }}
      />
    </div>
  );
}