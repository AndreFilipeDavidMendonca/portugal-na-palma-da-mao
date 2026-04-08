import { useEffect, useRef } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import ToastHost from "@/components/Toastr/ToastHost";
import { toast } from "@/components/Toastr/toast";

export default function App() {
  const lastBackRef = useRef(0);

  useEffect(() => {
    // impede sair logo ao primeiro back
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      const now = Date.now();

      if (now - lastBackRef.current < 2000) {
        // segundo back → deixa sair
        window.history.back();
        return;
      }

      lastBackRef.current = now;

      toast.info("Carrega novamente para sair");

      // mantém na app
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>

      <ToastHost position="top-right" />
    </div>
  );
}