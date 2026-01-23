import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import LoginPage from "@/pages/login/LoginPage";
import RegisterPage from "@/pages/register/RegisterPage";
import "@/styles/base.scss";

export default function App() {
    return (
        <div className="app-root">
            <div className="map-pad">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* opcional: fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </div>
    );
}