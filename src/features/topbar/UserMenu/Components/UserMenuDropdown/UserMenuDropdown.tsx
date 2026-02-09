import type { CurrentUserDto } from "@/lib/api";
import UserMenuHeader from "../UserMenuHeader/UserMenuHeader";
import "./UserMenuDropdown.scss";
import {toast} from "@/components/Toastr/toast";

type Props = {
    user: CurrentUserDto | null;
    isBusiness: boolean;
    favOpen: boolean;
    myPoisOpen: boolean;
    onToggleFavorites: () => void;
    onToggleMyPois: () => void;
    onLogout: () => void;
    onLogin: () => void;
};

export default function UserMenuDropdown({
                                             user,
                                             isBusiness,
                                             favOpen,
                                             myPoisOpen,
                                             onToggleFavorites,
                                             onToggleMyPois,
                                             onLogout,
                                             onLogin,
                                         }: Props) {
    return (
        <div className="user-menu__dropdown" role="menu">
            {user ? (
                <>
                    <UserMenuHeader email={user.email ?? null} role={user.role ?? null} />

                    <button
                        type="button"
                        className={`user-menu__section ${favOpen ? "is-open" : ""}`}
                        onClick={onToggleFavorites}
                    >
                        <span className="user-menu__chev" aria-hidden="true">◂</span>
                        <span className="user-menu__section-title">Favoritos</span>
                    </button>

                    {isBusiness && (
                        <button
                            type="button"
                            className={`user-menu__section ${myPoisOpen ? "is-open" : ""}`}
                            onClick={onToggleMyPois}
                        >
                            <span className="user-menu__chev" aria-hidden="true">◂</span>
                            <span className="user-menu__section-title">Os meus POIs</span>
                        </button>
                    )}

                    <div className="user-menu__divider" />

                    <button
                        type="button"
                        className="user-menu__item user-menu__item--danger"
                        onClick={() => {
                            onLogout();
                            toast.success("Sessão terminada com sucesso.");
                        }}
                        role="menuitem"
                    >
                        Logout
                    </button>
                </>
            ) : (
                <button
                    type="button"
                    className="user-menu__item user-menu__item--primary"
                    onClick={onLogin}
                    role="menuitem"
                >
                    Login
                </button>
            )}
        </div>
    );
}