import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Importações de estilos globais
import 'leaflet/dist/leaflet.css'
import './styles/leaflet-fixes.css'
import './styles/base.css' // 👈 adiciona aqui

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)