import { createContext, useContext } from 'react'

const ToastContext = createContext(null)

const noopToast = () => undefined

export function AppToastProvider({ children }) {
  return <ToastContext.Provider value={{ toast: noopToast }}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within AppToastProvider')
  return ctx
}
