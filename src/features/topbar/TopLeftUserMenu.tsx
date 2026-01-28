// src/features/topbar/TopRightUserMenu.tsx
import UserMenu from "@/features/topbar/UserMenu";
import "./TopLeftUserMenu.scss";

export default function TopLeftUserMenu() {
    return (
        <div className="top-left-user-menu">
            <UserMenu />
        </div>
    );
}