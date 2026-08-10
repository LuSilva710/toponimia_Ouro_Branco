import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AssociacaoPage from './pages/Games/AssociacaoPage.jsx'
import './styles/style_games.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AssociacaoPage />
  </StrictMode>,
)
