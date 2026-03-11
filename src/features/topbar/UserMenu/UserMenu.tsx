import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/auth/AuthContext";
import {
  addFavorite,
  deletePoiById,
  fetchFavorites,
  fetchMyPois,
  logout,
  removeFavorite,
  type FavoriteDto,
} from "@/lib/api";

import UserMenuButton from "./Components/UserMenuButton/UserMenuButton";
import UserMenuDropdown from "./Components/UserMenuDropdown/UserMenuDropdown";
import FavoritesFlyout from "./Components/FavoritesFlyout/FavoritesFlyout";
import MyPoisFlyout from "./Components/MyPoisFlyout/MyPoisFlyout";

import "./UserMenu.scss";

type MyPoiDto = {
  id: number;
  name: string;
  image: string | null;
};

const createEmptySet = () => new Set<number>();

function emitOpenLogin() {
  window.dispatchEvent(new Event("pt:open-login"));
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
  const [favOpen, setFavOpen] = useState(false);
  const [myPoisOpen, setMyPoisOpen] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [favError, setFavError] = useState<string | null>(null);
  const [busyPoiIds, setBusyPoiIds] = useState<Set<number>>(createEmptySet);

  const [myPois, setMyPois] = useState<MyPoiDto[]>([]);
  const [myPoisLoading, setMyPoisLoading] = useState(false);
  const [myPoisError, setMyPoisError] = useState<string | null>(null);
  const [busyDeletePoiIds, setBusyDeletePoiIds] = useState<Set<number>>(createEmptySet);

  const isBusiness = useMemo(
    () => user?.role === "BUSINESS" || user?.role === "ADMIN",
    [user?.role]
  );

  const closeAll = useCallback(() => {
    setOpen(false);
    setFavOpen(false);
    setMyPoisOpen(false);
  }, []);

  const resetPanels = useCallback(() => {
    setFavOpen(false);
    setMyPoisOpen(false);
    setFavorites([]);
    setMyPois([]);
    setBusyPoiIds(createEmptySet);
    setBusyDeletePoiIds(createEmptySet);
    setFavError(null);
    setMyPoisError(null);
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

  useEffect(() => {
    if (!open || !user) return;

    loadFavorites();
    if (isBusiness) {
      loadMyPois();
    }
  }, [open, user, isBusiness, loadFavorites, loadMyPois]);

  const handleLogin = useCallback(() => {
    closeAll();
    emitOpenLogin();
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

  const handleToggleFavorites = useCallback(() => {
    setFavOpen((prev) => !prev);
    setMyPoisOpen(false);
  }, []);

  const handleToggleMyPois = useCallback(() => {
    setMyPoisOpen((prev) => !prev);
    setFavOpen(false);
  }, []);

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
        `Tens a certeza que queres eliminar este POI${poiName ? ` (“${poiName}”)` : ""}?`
      );

      if (!confirmed) return;

      setMyPoisError(null);
      setBusyDeletePoiIds((prev) => new Set(prev).add(poiId));

      try {
        await deletePoiById(poiId);
        setMyPois((prev) => prev.filter((poi) => poi.id !== poiId));
      } catch (err: any) {
        setMyPoisError(err?.message ?? "Falha ao eliminar POI");
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

  return (
    <div className="user-menu gold-scroll" ref={wrapRef}>
      <UserMenuButton
        email={user?.email ?? null}
        isOpen={open}
        onToggle={() => setOpen((prev) => !prev)}
      />

      {open && (
        <>
          <UserMenuDropdown
            user={user}
            isBusiness={isBusiness}
            favOpen={favOpen}
            myPoisOpen={myPoisOpen}
            onToggleFavorites={handleToggleFavorites}
            onToggleMyPois={handleToggleMyPois}
            onLogout={handleLogout}
            onLogin={handleLogin}
          />

          {user && favOpen && (
            <FavoritesFlyout
              loading={favLoading}
              error={favError}
              favorites={favorites}
              busyPoiIds={busyPoiIds}
              onClose={() => setFavOpen(false)}
              onOpenPoi={handleOpenPoi}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {user && isBusiness && myPoisOpen && (
            <MyPoisFlyout
              loading={myPoisLoading}
              error={myPoisError}
              myPois={myPois}
              busyDeletePoiIds={busyDeletePoiIds}
              onClose={() => setMyPoisOpen(false)}
              onCreatePoi={handleCreatePoi}
              onOpenPoi={handleOpenPoi}
              onDeletePoi={handleDeletePoi}
            />
          )}
        </>
      )}
    </div>
  );
}