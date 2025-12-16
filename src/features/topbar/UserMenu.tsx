import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import { logout, type CurrentUserDto } from "@/lib/api";
import "./UserMenu.scss";

type Props = {
    currentUser: CurrentUserDto | null;
    onLoggedOut?: () => void;
};

function initialsFromEmail(email?: string | null) {
    const s = (email ?? "").trim();
    if (!s) return "?";
    const left = s.split("@")[0] ?? s;
    const parts = left.split(/[.\-_]+/).filter(Boolean);

    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return left.slice(0, 2).toUpperCase();
}

export default function UserMenu({ currentUser, onLoggedOut }: Props) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const from = useMemo(() => location.pathname ?? "/", [location.pathname]);

    const goLogin = () => {
        setOpen(false);
        navigate("/login", { state: { from } });
    };

    const doLogout = async () => {
        setOpen(false);
        await logout();
        onLoggedOut?.();
    };

    return (
        <div className="user-menu" ref={wrapRef}>
            <button
                type="button"
                className="user-menu__btn"
                onClick={() => setOpen((v) => !v)}
                title={currentUser ? currentUser.email : "Login"}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <img src={logo} alt=".pt" />
            </button>

            {open && (
                <div className="user-menu__dropdown" role="menu">
                    {currentUser ? (
                        <>
                            <div className="user-menu__header">
                                <div className="user-menu__avatar">
                                    {initialsFromEmail(currentUser.email)}
                                </div>

                                <div className="user-menu__meta">
                                    <div className="user-menu__email">{currentUser.email}</div>
                                    <div className="user-menu__role">{currentUser.role}</div>
                                </div>
                            </div>

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
                            className="user-menu__item"
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