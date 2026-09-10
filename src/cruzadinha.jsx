import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CruzadinhaPage from './pages/Games/CruzadinhaPage.jsx'
import './styles/style_game.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CruzadinhaPage />
  </StrictMode>,
)
