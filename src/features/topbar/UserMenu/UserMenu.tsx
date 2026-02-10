// src/components/UserMenu/UserMenu.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

type MyPoiDto = { id: number; name: string; image: string | null };

export default function UserMenu() {
    const { user, setUser, refreshUser } = useAuth();

    const [open, setOpen] = useState(false);
    const [favOpen, setFavOpen] = useState(false);
    const [myPoisOpen, setMyPoisOpen] = useState(false);

    const [favLoading, setFavLoading] = useState(false);
    const [favError, setFavError] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
    const [busyPoiIds, setBusyPoiIds] = useState<Set<number>>(() => new Set());

    const [myPois, setMyPois] = useState<MyPoiDto[]>([]);
    const [myPoisLoading, setMyPoisLoading] = useState(false);
    const [myPoisError, setMyPoisError] = useState<string | null>(null);
    const [busyDeletePoiIds, setBusyDeletePoiIds] = useState<Set<number>>(() => new Set());

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const from = useMemo(() => location.pathname ?? "/", [location.pathname]);
    const isBusiness = user?.role === "BUSINESS" || user?.role === "ADMIN";

    const closeAll = useCallback(() => {
        setOpen(false);
        setFavOpen(false);
        setMyPoisOpen(false);
    }, []);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) closeAll();
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [closeAll]);

    const loadFavorites = useCallback(async () => {
        if (!user) return;
        setFavError(null);
        setFavLoading(true);
        try {
            const list = await fetchFavorites();
            setFavorites(list ?? []);
        } catch (e: any) {
            setFavError(e?.message ?? "Falha a carregar favoritos");
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
        } catch (e: any) {
            setMyPoisError(e?.message ?? "Falha a carregar os meus POIs");
        } finally {
            setMyPoisLoading(false);
        }
    }, [user, isBusiness]);

    useEffect(() => {
        if (!open || !user) return;
        loadFavorites();
        if (isBusiness) loadMyPois();
    }, [open, user, loadFavorites, loadMyPois, isBusiness]);

    useEffect(() => {
        if (user) return;
        setFavOpen(false);
        setMyPoisOpen(false);
        setFavorites([]);
        setMyPois([]);
        setBusyPoiIds(new Set());
        setBusyDeletePoiIds(new Set());
    }, [user]);

    const goLogin = () => {
        closeAll();
        navigate("/login", { state: { from } });
    };

    const doLogout = async () => {
        closeAll();
        await logout().catch(() => null);
        setUser(null);
        await refreshUser().catch(() => null);
    };

    const openPoi = (poiId: number) => {
        closeAll();
        window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId } }));
    };

    const goCreatePoi = () => {
        closeAll();
        navigate("/pois/new", { state: { from } });
    };

    const toggleFavorite = async (poiId: number) => {
        if (!user) return;
        if (busyPoiIds.has(poiId)) return;

        setFavError(null);
        setBusyPoiIds((prev) => new Set(prev).add(poiId));

        const exists = favorites.some((f) => f.poiId === poiId);

        try {
            if (exists) {
                await removeFavorite(poiId);
                setFavorites((prev) => prev.filter((f) => f.poiId !== poiId));
            } else {
                await addFavorite(poiId);
                await loadFavorites();
            }
        } catch (e: any) {
            setFavError(e?.message ?? "Falha a atualizar favorito");
        } finally {
            setBusyPoiIds((prev) => {
                const next = new Set(prev);
                next.delete(poiId);
                return next;
            });
        }
    };

    const deleteMyPoi = async (poiId: number, poiName?: string) => {
        if (!user) return;
        if (busyDeletePoiIds.has(poiId)) return;

        const ok = window.confirm(
            `Tens a certeza que queres eliminar este POI${poiName ? ` (“${poiName}”)` : ""}?`
        );
        if (!ok) return;

        setMyPoisError(null);
        setBusyDeletePoiIds((prev) => new Set(prev).add(poiId));

        try {
            await deletePoiById(poiId);
            setMyPois((prev) => prev.filter((p) => p.id !== poiId));
        } catch (e: any) {
            setMyPoisError(e?.message ?? "Falha ao eliminar POI");
        } finally {
            setBusyDeletePoiIds((prev) => {
                const next = new Set(prev);
                next.delete(poiId);
                return next;
            });
        }
    };

    return (
        <div className="user-menu" ref={wrapRef}>
            <UserMenuButton email={user?.email ?? null} isOpen={open} onToggle={() => setOpen((v) => !v)} />

            {open && (
                <>
                    <UserMenuDropdown
                        user={user}
                        isBusiness={isBusiness}
                        favOpen={favOpen}
                        myPoisOpen={myPoisOpen}
                        onToggleFavorites={() => {
                            setFavOpen((v) => !v);
                            setMyPoisOpen(false);
                        }}
                        onToggleMyPois={() => {
                            setMyPoisOpen((v) => !v);
                            setFavOpen(false);
                        }}
                        onLogout={doLogout}
                        onLogin={goLogin}
                    />

                    {user && favOpen && (
                        <FavoritesFlyout
                            loading={favLoading}
                            error={favError}
                            favorites={favorites}
                            busyPoiIds={busyPoiIds}
                            onClose={() => setFavOpen(false)}
                            onOpenPoi={openPoi}
                            onToggleFavorite={toggleFavorite}
                        />
                    )}

                    {user && isBusiness && myPoisOpen && (
                        <MyPoisFlyout
                            loading={myPoisLoading}
                            error={myPoisError}
                            myPois={myPois}
                            busyDeletePoiIds={busyDeletePoiIds}
                            onClose={() => setMyPoisOpen(false)}
                            onCreatePoi={goCreatePoi}
                            onOpenPoi={openPoi}
                            onDeletePoi={deleteMyPoi}
                        />
                    )}
                </>
            )}
        </div>
    );
}