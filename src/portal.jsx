import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PortalPage from './pages/Portal/PortalPage.jsx'
import './styles/style_portal.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PortalPage />
  </StrictMode>,
)
