// src/App.tsx
import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Home from "@/pages/Home";
import TopLeftUserMenu from "@/features/topbar/TopRightUserMenu";

import { fetchCurrentUser, type CurrentUserDto } from "@/lib/api";
import RegisterPage from "@/pages/register/RegisterPage";
import LoginPage from "@/pages/login/LoginPage";
export default function App() {
    const [currentUser, setCurrentUser] = useState<CurrentUserDto | null>(null);

    const refreshUser = useCallback(async () => {
        const u = await fetchCurrentUser().catch(() => null);
        setCurrentUser(u);
        return u;
    }, []);

    // 1x no arranque
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    return (
        <div className="app-root">
            {/* ✅ SEMPRE montado */}
            <TopLeftUserMenu currentUser={currentUser} onLoggedOut={refreshUser} />

            <Routes>
                <Route path="/" element={<Home  />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Routes>
        </div>
    );
}