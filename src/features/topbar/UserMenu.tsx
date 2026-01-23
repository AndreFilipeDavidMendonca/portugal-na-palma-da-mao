// src/features/topbar/UserMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
    addFavorite,
    fetchFavorites,
    logout,
    removeFavorite,
    type FavoriteDto,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import "./UserMenu.scss";

function initialsFromEmail(email?: string | null) {
    const s = (email ?? "").trim();
    if (!s) return "?";

    const left = s.split("@")[0] ?? s;
    const parts = left.split(/[.\-_]+/).filter(Boolean);

    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return left.slice(0, 2).toUpperCase();
}

export default function UserMenu() {
    const { user, setUser } = useAuth();

    const [open, setOpen] = useState(false);
    const [favOpen, setFavOpen] = useState(false);

    const [favLoading, setFavLoading] = useState(false);
    const [favError, setFavError] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
    const [busyPoiIds, setBusyPoiIds] = useState<Set<number>>(new Set());

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const from = useMemo(() => location.pathname ?? "/", [location.pathname]);

    // fecha dropdown ao clicar fora
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setFavOpen(false);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    // quando o menu abre e há user, carrega favoritos
    useEffect(() => {
        if (!open) return;
        if (!user) return;

        setFavError(null);
        setFavLoading(true);

        fetchFavorites()
            .then((list) => setFavorites(list ?? []))
            .catch((e: any) => setFavError(e?.message ?? "Falha a carregar favoritos"))
            .finally(() => setFavLoading(false));
    }, [open, user]);

    // se fizer logout (ou perder sessão), limpa estado local
    useEffect(() => {
        if (user) return;
        setFavOpen(false);
        setFavorites([]);
        setFavError(null);
        setBusyPoiIds(new Set());
    }, [user]);

    const goLogin = () => {
        setOpen(false);
        setFavOpen(false);
        navigate("/login", { state: { from } });
    };

    const doLogout = async () => {
        setOpen(false);
        setFavOpen(false);
        await logout();
        setUser(null);
    };

    const openPoi = (poiId: number) => {
        setOpen(false);
        setFavOpen(false);
        window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId } }));
    };

    async function toggleFavorite(poiId: number) {
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
                // refresh leve para puxar name/image corretos
                const list = await fetchFavorites();
                setFavorites(list ?? []);
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
    }

    return (
        <div className="user-menu" ref={wrapRef}>
            <button
                type="button"
                className="user-menu__btn"
                onClick={() => setOpen((v) => !v)}
                title={user ? user.email : "Conta"}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <img src={logo} alt=".pt" />
            </button>

            {open && (
                <div className="user-menu__dropdown" role="menu">
                    {user ? (
                        <>
                            <div className="user-menu__header">
                                <div className="user-menu__avatar">{initialsFromEmail(user.email)}</div>

                                <div className="user-menu__meta">
                                    <div className="user-menu__email">{user.email}</div>
                                    <div className="user-menu__role">{user.role}</div>
                                </div>
                            </div>

                            <div className="user-menu__divider" />

                            <button
                                type="button"
                                className="user-menu__item user-menu__item--primary"
                                onClick={() => setFavOpen((v) => !v)}
                                role="menuitem"
                            >
                                Favoritos
                            </button>

                            {favOpen && (
                                <div className="user-menu__favorites">
                                    {favLoading && <div className="user-menu__hint">A carregar…</div>}
                                    {favError && <div className="user-menu__error">{favError}</div>}

                                    {!favLoading && !favError && favorites.length === 0 && (
                                        <div className="user-menu__hint">Ainda não tens favoritos.</div>
                                    )}

                                    {!favLoading &&
                                        !favError &&
                                        favorites.map((f) => {
                                            const busy = busyPoiIds.has(f.poiId);

                                            return (
                                                <div key={f.poiId} className="user-menu__fav-row">
                                                    <button
                                                        type="button"
                                                        className="user-menu__fav-main"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openPoi(f.poiId);
                                                        }}
                                                        title={f.name}
                                                    >
                                                        <div className="user-menu__fav-thumb">
                                                            {f.image ? (
                                                                <img src={f.image} alt={f.name} />
                                                            ) : (
                                                                <div className="user-menu__fav-noimg" />
                                                            )}
                                                        </div>
                                                        <div className="user-menu__fav-name">{f.name}</div>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="user-menu__fav-star"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation(); // ✅ não deixa “clicar no row”
                                                            toggleFavorite(f.poiId);
                                                        }}
                                                        disabled={busy}
                                                        title="Remover dos favoritos"
                                                    >
                                                        ★
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}

                            <div className="user-menu__divider" />

                            <button
                                type="button"
                                className="user-menu__item user-menu__item--danger"
                                onClick={doLogout}
                                role="menuitem"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="user-menu__item user-menu__item--primary"
                            onClick={goLogin}
                            role="menuitem"
                        >
                            Login
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}