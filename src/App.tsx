import { Routes, Route } from "react-router-dom"
import Home from "@/pages/Home"

export default function App() {
  return (
    <div className="app-root">
      <header className="header">
        <strong>Portugal na mão</strong>
        <input placeholder="Pesquisar distrito, concelho, local..." />
        <button className="btn">Filtros</button>
        <span className="btn">/</span>
      </header>
      <div className="map-pad">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </div>
  )
}
