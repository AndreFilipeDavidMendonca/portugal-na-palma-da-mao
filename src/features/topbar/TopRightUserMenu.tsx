// src/features/topbar/TopRightUserMenu.tsx
import UserMenu from "@/features/topbar/UserMenu/UserMenu";
import "./TopRightUserMenu.scss";

export default function TopRightUserMenu() {
    return (
        <div className="top-right-user-menu">
            <UserMenu />
        </div>
    );
}