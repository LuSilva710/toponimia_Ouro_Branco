import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AboutPage from '@pages/About/AboutPage.jsx'

/**
 * Shell SPA (em construção).
 * Hoje a página Sobre usa `main.jsx` diretamente.
 * Nas próximas migrações, as rotas abaixo passam a ser o entry único.
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/about" element={<AboutPage />} />
        <Route path="/about.html" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/about" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
