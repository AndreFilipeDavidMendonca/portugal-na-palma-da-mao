import { Routes, Route } from "react-router-dom"
import Home from "@/pages/Home";
import "@/styles/base.scss";

export default function App() {
  return (
    <div className="app-root">
      <div className="map-pad">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </div>
  )
}
