import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MapaPage from './pages/Mapa/MapaPage.jsx'
import './styles/style_mapa.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MapaPage />
  </StrictMode>,
)
