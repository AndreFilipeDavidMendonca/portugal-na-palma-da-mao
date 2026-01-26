// src/features/topbar/TopRightUserMenu.tsx
import UserMenu from "@/features/topbar/UserMenu";
import type { CurrentUserDto } from "@/lib/api";
import "./TopRightUserMenu.scss";

type Props = {
    currentUser: CurrentUserDto | null;
    onLoggedOut?: () => void;
};

export default function TopRightUserMenu() {
    return (
        <div className="top-left-user-menu">
            <UserMenu />
        </div>
    );
}