import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthPortalProvider, AuthStaffProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmDialog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthStaffProvider>
            <AuthPortalProvider>
              <App />
            </AuthPortalProvider>
          </AuthStaffProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
)
