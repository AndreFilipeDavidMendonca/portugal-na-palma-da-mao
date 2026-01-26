// src/features/topbar/UserMenu.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { addFavorite, fetchFavorites, logout, removeFavorite, type FavoriteDto } from "@/lib/api";
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
    const [busyPoiIds, setBusyPoiIds] = useState<Set<number>>(() => new Set());

    const wrapRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const from = useMemo(() => location.pathname ?? "/", [location.pathname]);

    const closeAll = useCallback(() => {
        setOpen(false);
        setFavOpen(false);
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

    useEffect(() => {
        if (!open || !user) return;
        loadFavorites();
    }, [open, user, loadFavorites]);

    useEffect(() => {
        if (user) return;
        setFavOpen(false);
        setFavorites([]);
        setFavError(null);
        setBusyPoiIds(new Set());
    }, [user]);

    const goLogin = () => {
        closeAll();
        navigate("/login", { state: { from } });
    };

    const doLogout = async () => {
        closeAll();
        await logout();
        setUser(null);
    };

    const openPoi = (poiId: number) => {
        closeAll();
        window.dispatchEvent(new CustomEvent("pt:open-poi", { detail: { poiId } }));
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
                <>
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
                                    className={`user-menu__section ${favOpen ? "is-open" : ""}`}
                                    onClick={() => setFavOpen((v) => !v)}
                                >
                                    <span className="user-menu__section-title">Favoritos</span>
                                    <span className="user-menu__chev" aria-hidden="true">▸</span>
                                </button>

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
                            <button type="button" className="user-menu__item user-menu__item--primary" onClick={goLogin} role="menuitem">
                                Login
                            </button>
                        )}
                    </div>

                    {/* ✅ Flyout à direita do dropdown 1 */}
                    {user && favOpen && (
                        <div className="user-menu__flyout" role="region" aria-label="Favoritos">
                            <div className="user-menu__flyout-header">
                                <span>Favoritos</span>

                                <button
                                    type="button"
                                    className="user-menu__flyout-close"
                                    onClick={() => setFavOpen(false)}
                                    aria-label="Fechar"
                                    title="Fechar"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="user-menu__favorites">
                                {favLoading && <div className="user-menu__hint">A carregar…</div>}
                                {favError && <div className="user-menu__error">{favError}</div>}

                                {!favLoading && !favError && favorites.length === 0 && (
                                    <div className="user-menu__hint">Ainda não tens favoritos.</div>
                                )}

                                {!favLoading && !favError && favorites.length > 0 && (
                                    <ul className="user-menu__fav-list">
                                        {favorites.map((f) => {
                                            const busy = busyPoiIds.has(f.poiId);
                                            const hasImage = Boolean(f.image);

                                            return (
                                                <li key={f.poiId} className="user-menu__fav-item">
                                                    <button
                                                        type="button"
                                                        className="user-menu__fav-link"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openPoi(f.poiId);
                                                        }}
                                                        title={f.name}
                                                    >
                                                        {hasImage && (
                                                            <span className="user-menu__fav-thumb">
                                <img src={f.image!} alt={f.name} />
                              </span>
                                                        )}
                                                        <span className="user-menu__fav-name">{f.name}</span>
                                                    </button>

                                                    {/* ✅ não é button, é só o X */}
                                                    <span
                                                        className={`user-menu__fav-x ${busy ? "is-disabled" : ""}`}
                                                        role="button"
                                                        tabIndex={busy ? -1 : 0}
                                                        title="Remover dos favoritos"
                                                        aria-label="Remover dos favoritos"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!busy) toggleFavorite(f.poiId);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (busy) return;
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                toggleFavorite(f.poiId);
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
                    )}
                </>
            )}
        </div>
    );
}