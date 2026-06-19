import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@routes/AppRoutes'
import { AuthBootstrap } from '@components/auth/AuthBootstrap'
import { ThemeProvider } from '@context/ThemeContext'
import './index.css'
import './styles/employee-dashboard-buttons.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthBootstrap>
          <AppRoutes />
        </AuthBootstrap>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
