import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import "leaflet/dist/leaflet.css"
import "./styles/leaflet-fixes.css"
import 'leaflet/dist/leaflet.css';
import './styles/leaflet-fixes.css';
import "@/styles/base.scss";
import {AuthProvider} from "@/auth/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
        <AuthProvider>
            <App />
        </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
