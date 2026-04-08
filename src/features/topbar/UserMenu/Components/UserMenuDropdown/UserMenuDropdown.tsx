import type { CurrentUserDto } from "@/lib/api";
import UserMenuHeader from "../UserMenuHeader/UserMenuHeader";
import "./UserMenuDropdown.scss";
import { toast } from "@/components/Toastr/toast";
import Button from "@/components/Button/Button";

export type UserMenuPanel = "favorites" | "myPois" | "notifications" | "friends" | null;

type Props = {
  user: CurrentUserDto | null;
  isBusiness: boolean;
  openPanel: UserMenuPanel;
  pendingCount: number;
  unreadFriendsMessagesCount?: number;
  onTogglePanel: (panel: Exclude<UserMenuPanel, null>) => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onLogin: () => void;
};

export default function UserMenuDropdown({
  user,
  isBusiness,
  openPanel,
  pendingCount,
  unreadFriendsMessagesCount = 0,
  onTogglePanel,
  onEditProfile,
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
            className="user-menu__section"
            onClick={onEditProfile}
            role="menuitem"
          >
            <span className="user-menu__chev" aria-hidden="true">
              ◂
            </span>
            <span className="user-menu__section-title">Editar perfil</span>
          </Button>

          <Button
            type="button"
            className={`user-menu__section ${openPanel === "notifications" ? "is-open" : ""}`}
            onClick={() => onTogglePanel("notifications")}
            role="menuitem"
          >
            <span className="user-menu__chev" aria-hidden="true">
              ◂
            </span>
            <span className="user-menu__section-title">Notificações</span>

            {pendingCount > 0 && (
              <span
                className="user-menu__section-badge"
                aria-label={`${pendingCount} convites pendentes`}
              >
                {pendingCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            className={`user-menu__section ${openPanel === "friends" ? "is-open" : ""}`}
            onClick={() => onTogglePanel("friends")}
            role="menuitem"
          >
            <span className="user-menu__chev" aria-hidden="true">
              ◂
            </span>
            <span className="user-menu__section-title">Amigos</span>

            {unreadFriendsMessagesCount > 0 && (
              <span
                className="user-menu__section-badge"
                aria-label={`${unreadFriendsMessagesCount} mensagens por ler`}
              >
                {unreadFriendsMessagesCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            className={`user-menu__section ${openPanel === "favorites" ? "is-open" : ""}`}
            onClick={() => onTogglePanel("favorites")}
            role="menuitem"
          >
            <span className="user-menu__chev" aria-hidden="true">
              ◂
            </span>
            <span className="user-menu__section-title">Favoritos</span>
          </Button>

          {isBusiness && (
            <Button
              type="button"
              className={`user-menu__section ${openPanel === "myPois" ? "is-open" : ""}`}
              onClick={() => onTogglePanel("myPois")}
              role="menuitem"
            >
              <span className="user-menu__chev" aria-hidden="true">
                ◂
              </span>
              <span className="user-menu__section-title">Os meus negócios</span>
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