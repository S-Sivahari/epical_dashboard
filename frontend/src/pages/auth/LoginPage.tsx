import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import { prefetchEmployeeDashboard } from '@/utils/prefetchEmployeeRoutes'
import { getApiBaseUrl, getGoogleOAuthStartUrl } from '@/config/apiBase'
import axios from 'axios'

const LOGIN_WORDMARK_SRC = '/pic/epical-layouts-wordmark.png?v=5'
const LOGIN_CHIP_SRC = '/pic/epical_layouts.jpeg?v=3'

type GoogleOAuthConfig = {
  enabled?: boolean
  redirectUri?: string
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const hydrateSession = useAuthStore((s) => s.hydrateSession)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleSignInEnabled, setGoogleSignInEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${getApiBaseUrl()}/auth/google/config`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GoogleOAuthConfig | null) => {
        if (!cancelled) setGoogleSignInEnabled(Boolean(data?.enabled))
      })
      .catch(() => {
        if (!cancelled) setGoogleSignInEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const oauthSuccess = queryParams.get('oauth') === 'success'

    if (oauthSuccess) {
      window.history.replaceState({}, '', '/auth/login')
      void (async () => {
        try {
          await hydrateSession()
          const currentRole = useAuthStore.getState().role
          prefetchEmployeeDashboard()
          navigate(currentRole === 'admin' ? '/admin' : '/employee', { replace: true })
        } catch {
          toast.error('Google sign-in completed but session could not be loaded. Try again.')
        }
      })()
      return
    }

    const error = queryParams.get('error')
    if (error) {
      window.history.replaceState({}, '', '/auth/login')
      const decoded = decodeURIComponent(error)
      toast.error(
        decoded === 'google_auth_failed'
          ? 'Google sign-in failed. You must be added by an admin first, and deactivated accounts cannot sign in.'
          : decoded,
      )
    }
  }, [hydrateSession, navigate])

  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'admin' ? '/admin' : '/employee', { replace: true })
    }
  }, [isAuthenticated, navigate, role])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password)
      prefetchEmployeeDashboard()
      const userRole = useAuthStore.getState().role
      navigate(userRole === 'admin' ? '/admin' : '/employee', { replace: true })
    } catch (error) {
      let message = 'Unable to sign in'
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          message =
            'Cannot reach the API server. Run npm run dev from the project root and ensure the backend is on port 3000.'
        } else {
          const data = error.response.data as { error?: string } | undefined
          message = data?.error ?? error.message
        }
      } else if (error instanceof Error) {
        message = error.message
      }
      toast.error(message)
    }
  })

  const handleGoogleRedirect = () => {
    setGoogleLoading(true)
    window.location.assign(getGoogleOAuthStartUrl())
  }

  return (
    <div className="login-page login-page--split">
      <div className="login-split-wrap">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className={`login-split-card ${googleSignInEnabled ? '' : 'login-split-card--single'}`}
        >
          <div className="login-split-left">
            <div className="login-split-wordmark-wrap">
              <img
                src={LOGIN_WORDMARK_SRC}
                alt="Epical Layouts"
                width={520}
                height={72}
                className="login-split-wordmark"
                draggable={false}
                decoding="async"
              />
            </div>

            <div className="login-split-left-main">
              <header className="login-split-left-head">
                <h1 className="login-split-title">Login</h1>
                <p className="login-split-subtitle">Welcome back</p>
              </header>

              <form className="login-split-form" onSubmit={onSubmit} noValidate>
              <div className="login-split-field">
                <label className="login-split-label" htmlFor="login-email">
                  Email
                </label>
                <div className={`login-split-input-wrap ${errors.email ? 'login-split-input-wrap--error' : ''}`}>
                  <span className="login-split-input-prefix" aria-hidden>
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="login-split-input"
                    {...register('email')}
                  />
                </div>
                {errors.email ? <p className="login-split-error">{errors.email.message}</p> : null}
              </div>

              <div className="login-split-field">
                <label className="login-split-label" htmlFor="login-password">
                  Password
                </label>
                <div className={`login-split-input-wrap ${errors.password ? 'login-split-input-wrap--error' : ''}`}>
                  <span className="login-split-input-prefix" aria-hidden>
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Password"
                    className="login-split-input login-split-input--password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="login-split-input-suffix"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="login-split-error">{errors.password.message}</p> : null}
              </div>

              <div className="login-split-actions">
                <button type="submit" className="login-split-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in…' : 'Login'}
                </button>
              </div>
              </form>
            </div>
          </div>

          {googleSignInEnabled ? (
            <div className="login-split-right">
              <div className="login-split-chip-wrap">
                <img
                  src={LOGIN_CHIP_SRC}
                  alt=""
                  width={140}
                  height={140}
                  className="login-split-chip"
                  draggable={false}
                  decoding="async"
                  aria-hidden
                />
              </div>
              <button
                type="button"
                className="login-split-google-btn"
                onClick={handleGoogleRedirect}
                disabled={googleLoading}
              >
                <GoogleMark />
                <span>{googleLoading ? 'Redirecting…' : 'Login using Google'}</span>
              </button>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}
