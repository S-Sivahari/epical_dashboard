import { createContext, useContext, useState, useCallback } from 'react'
import { ToastProvider as RadixProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from '@components/employee/ui/toast'

const ToastContext = createContext(null)

export function AppToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ title, description, variant = 'default' }) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, title, description, variant, open: true }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixProvider>
        {children}
        {toasts.map((t) => (
          <Toast key={t.id} open={t.open}>
            <div>
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && <ToastDescription>{t.description}</ToastDescription>}
            </div>
          </Toast>
        ))}
        <ToastViewport />
      </RadixProvider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within AppToastProvider')
  return ctx
}
