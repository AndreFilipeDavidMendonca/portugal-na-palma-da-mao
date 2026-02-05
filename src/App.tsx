// src/App.tsx
import { useCallback, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Home from "@/pages/Home";

import { fetchCurrentUser, type CurrentUserDto } from "@/lib/api";
import RegisterPage from "@/pages/register/RegisterPage";
import LoginPage from "@/pages/login/LoginPage";
import CreatePoiPage from "@/pages/poi/CreatePoiPage";

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
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/pois/new" element={<CreatePoiPage />} />
            </Routes>
        </div>
    );
}