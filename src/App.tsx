import { useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import ToastHost from "@/components/Toastr/ToastHost";
import { toast } from "@/components/Toastr/toast";

export default function App() {
  const isExitPromptOpenRef = useRef(false);

  useEffect(() => {
    window.history.pushState({ appGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (isExitPromptOpenRef.current) {
        window.history.pushState({ appGuard: true }, "", window.location.href);
        return;
      }

      isExitPromptOpenRef.current = true;

      toast.confirm("Queres sair da app?", {
        confirmLabel: "✓",
        cancelLabel: "×",
        onConfirm: () => {
          isExitPromptOpenRef.current = false;
          window.removeEventListener("popstate", handlePopState);
          window.history.back();
        },
        onCancel: () => {
          isExitPromptOpenRef.current = false;
          window.history.pushState({ appGuard: true }, "", window.location.href);
        },
        durationMs: 0,
      });

      window.history.pushState({ appGuard: true }, "", window.location.href);
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