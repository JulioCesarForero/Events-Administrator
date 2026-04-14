import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthPortalProvider, AuthStaffProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthStaffProvider>
      <AuthPortalProvider>
        <App />
      </AuthPortalProvider>
    </AuthStaffProvider>
  </StrictMode>,
)
