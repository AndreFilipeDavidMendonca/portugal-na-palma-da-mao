
import { Routes, Route, useLocation } from 'react-router-dom'
import Home from '@/pages/Home'
import District from '@/pages/District'
import Municipio from '@/pages/Municipio'
import Freguesia from '@/pages/Freguesia'

export default function App(){
  const loc = useLocation()
  return (
    <div>
      <header className="header">
        <strong>Portugal na mão</strong>
        <input placeholder="Pesquisar distrito, concelho, local..." />
        <button className="btn">Filtros</button>
        <span className="btn">{loc.pathname}</span>
      </header>
      <div className="map-pad">
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/district/lisboa" element={<District/>} />
          <Route path="/municipio/lisboa" element={<Municipio/>} />
          <Route path="/freguesia/alfama" element={<Freguesia/>} />
        </Routes>
      </div>
    </div>
  )
}
