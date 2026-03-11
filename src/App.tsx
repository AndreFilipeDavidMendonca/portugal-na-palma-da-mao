import { Navigate, Route, Routes } from "react-router-dom";

import Home from "@/pages/Home";
import ToastHost from "@/components/Toastr/ToastHost";

export default function App() {
  return (
    <div className="app-root">
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>

      <ToastHost position="top-right" />
    </div>
  );
}