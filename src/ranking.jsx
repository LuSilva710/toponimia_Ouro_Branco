import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RankingPage from './pages/Games/RankingPage.jsx'
import './styles/style_games.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RankingPage />
  </StrictMode>,
)
