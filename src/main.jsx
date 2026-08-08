import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AboutPage from '@pages/About/AboutPage.jsx'
import '@styles/style_about.css'

/**
 * Entry da página Sobre (multi-page + React).
 * Quando a SPA estiver completa, este arquivo pode apontar para App.jsx.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AboutPage />
  </StrictMode>,
)
