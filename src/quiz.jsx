import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import QuizPage from './pages/Games/QuizPage.jsx'
import './styles/style_games.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QuizPage />
  </StrictMode>,
)
