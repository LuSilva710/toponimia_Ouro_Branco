import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EstatisticasPage from './pages/Estatisticas/EstatisticasPage.jsx'
import './styles/style_stats.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EstatisticasPage />
  </StrictMode>,
)
