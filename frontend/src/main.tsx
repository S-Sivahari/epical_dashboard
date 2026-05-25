import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'sonner'
import { AppRoutes } from '@routes/AppRoutes'
import { ThemeProvider } from '@context/ThemeContext'
import './index.css'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="bottom-right" richColors closeButton />
        </BrowserRouter>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
