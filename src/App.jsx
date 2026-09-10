import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AboutPage from '@pages/About/AboutPage.jsx'

/**
 * @deprecated Shell SPA de experimento — NÃO é entry do runtime MPA.
 * Produção usa `*.html` + `src/*.jsx` (ex.: about.jsx → AboutPage).
 * Manter só como referência para uma futura unificação SPA (P2).
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
