import type { CurrentUserDto } from "@/lib/api";
import UserMenuHeader from "../UserMenuHeader/UserMenuHeader";
import "./UserMenuDropdown.scss";
import {toast} from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";

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

                    <Button
                        type="button"
                        className={`user-menu__section ${favOpen ? "is-open" : ""}`}
                        onClick={onToggleFavorites}
                    >
                        <span className="user-menu__chev" aria-hidden="true">◂</span>
                        <span className="user-menu__section-title">Favoritos</span>
                    </Button>

                    {isBusiness && (
                        <Button
                            type="button"
                            className={`user-menu__section ${myPoisOpen ? "is-open" : ""}`}
                            onClick={onToggleMyPois}
                        >
                            <span className="user-menu__chev" aria-hidden="true">◂</span>
                            <span className="user-menu__section-title">Os meus POIs</span>
                        </Button>
                    )}

                    <div className="user-menu__divider" />

                    <Button
                        type="button"
                        className="user-menu__item user-menu__item--danger"
                        onClick={() => {
                            onLogout();
                            toast.success("Sessão terminada com sucesso.");
                        }}
                        role="menuitem"
                    >
                        Logout
                    </Button>
                </>
            ) : (
                <Button
                    type="button"
                    className="user-menu__item user-menu__item--primary"
                    onClick={onLogin}
                    role="menuitem"
                >
                    Login
                </Button>
            )}
        </div>
    );
}