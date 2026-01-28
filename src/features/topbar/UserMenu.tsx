// src/features/topbar/UserMenu.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import {
    addFavorite,
    fetchFavorites,
    fetchMyPois,
    logout,
    removeFavorite,
    type FavoriteDto,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import "./UserMenu.scss";

type MyPoiDto = {
    id: number;
    name: string;
    image: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8085";

function initialsFromEmail(email?: string | null) {
    const s = (email ?? "").trim();
    if (!s) return "?";
    const left = s.split("@")[0] ?? s;
    const parts = left.split(/[.\-_]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return left.slice(0, 2).toUpperCase();
}

async function deletePoiById(poiId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/pois/${poiId}`, {
        method: "DELETE",
        credentials: "include",
    });

    // backend pode devolver 200/204
    if (res.status === 204) return;
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Falha ao eliminar POI (status ${res.status})`);
    }
}

export default function UserMenu() {
    const { user, setUser } = useAuth();

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

    /* ---------------- Favorites ---------------- */

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

    /* ---------------- My POIs ---------------- */

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

    /* ---------------- Actions ---------------- */

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

                                <button
                                    type="button"
                                    className={`user-menu__section ${favOpen ? "is-open" : ""}`}
                                    onClick={() => {
                                        setFavOpen((v) => !v);
                                        setMyPoisOpen(false);
                                    }}
                                >
                                    <span className="user-menu__section-title">Favoritos</span>
                                    <span className="user-menu__chev" aria-hidden="true">
                    ▸
                  </span>
                                </button>

                                {isBusiness && (
                                    <button
                                        type="button"
                                        className={`user-menu__section ${myPoisOpen ? "is-open" : ""}`}
                                        onClick={() => {
                                            setMyPoisOpen((v) => !v);
                                            setFavOpen(false);
                                        }}
                                    >
                                        <span className="user-menu__section-title">Os meus POIs</span>
                                        <span className="user-menu__chev" aria-hidden="true">
                      ▸
                    </span>
                                    </button>
                                )}


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

                    {/* ✅ Flyout Favoritos */}
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

                    {/* ✅ Flyout Os meus POIs */}
                    {user && isBusiness && myPoisOpen && (
                        <div className="user-menu__flyout" role="region" aria-label="Os meus POIs">
                            <div className="user-menu__flyout-header">
                                <span>Os meus POIs</span>

                                <button
                                    type="button"
                                    className="user-menu__flyout-close"
                                    onClick={() => setMyPoisOpen(false)}
                                    aria-label="Fechar"
                                    title="Fechar"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="user-menu__favorites">
                                <button
                                    type="button"
                                    className="user-menu__item user-menu__item--primary user-menu__item--full"
                                    onClick={goCreatePoi}
                                >
                                    + Criar POI
                                </button>

                                {myPoisLoading && <div className="user-menu__hint">A carregar…</div>}
                                {myPoisError && <div className="user-menu__error">{myPoisError}</div>}

                                {!myPoisLoading && !myPoisError && myPois.length === 0 && (
                                    <div className="user-menu__hint">Ainda não criaste POIs.</div>
                                )}

                                {!myPoisLoading && !myPoisError && myPois.length > 0 && (
                                    <ul className="user-menu__fav-list">
                                        {myPois.map((p) => {
                                            const hasImage = Boolean(p.image);
                                            const busyDel = busyDeletePoiIds.has(p.id);

                                            return (
                                                <li key={p.id} className="user-menu__fav-item">
                                                    <button
                                                        type="button"
                                                        className="user-menu__fav-link"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openPoi(p.id);
                                                        }}
                                                        title={p.name}
                                                    >
                                                        {hasImage && (
                                                            <span className="user-menu__fav-thumb">
                                <img src={p.image!} alt={p.name} />
                              </span>
                                                        )}
                                                        <span className="user-menu__fav-name">{p.name}</span>
                                                    </button>

                                                    {/* ✅ X para eliminar */}
                                                    <span
                                                        className={`user-menu__fav-x ${busyDel ? "is-disabled" : ""}`}
                                                        role="button"
                                                        tabIndex={busyDel ? -1 : 0}
                                                        title="Eliminar POI"
                                                        aria-label="Eliminar POI"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!busyDel) deleteMyPoi(p.id, p.name);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (busyDel) return;
                                                            if (e.key === "Enter" || e.key === " ") {
                                                                e.preventDefault();
                                                                deleteMyPoi(p.id, p.name);
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