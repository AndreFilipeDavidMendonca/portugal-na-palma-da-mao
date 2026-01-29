import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import "leaflet/dist/leaflet.css";
import "./styles/leaflet-fixes.css";
import "@/styles/base.scss";

import { AuthProvider } from "@/auth/AuthContext";
import { PoiFiltersProvider } from "@/state/PoiFiltersContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AuthProvider>
            <PoiFiltersProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </PoiFiltersProvider>
        </AuthProvider>
    </React.StrictMode>
);