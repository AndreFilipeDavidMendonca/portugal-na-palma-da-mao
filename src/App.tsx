// src/App.tsx
import { Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import RegisterPage from "@/pages/register/RegisterPage";
import LoginPage from "@/pages/login/LoginPage";
import CreatePoiPage from "@/pages/poi/CreatePoiPage";
import ToastHost from "@/components/Toastr/ToastHost";

export default function App() {
    return (
        <div className="app-root">
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/pois/new" element={<CreatePoiPage />} />
            </Routes>

            <ToastHost position="top-right" />
        </div>
    );
}