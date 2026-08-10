import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminPage from './pages/Admin/AdminPage.jsx'
import './styles/style_admin.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminPage />
  </StrictMode>,
)
