import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { LoginBackground } from '@components/auth/LoginBackground'
import { LoginTopBrand } from '@components/auth/LoginTopBrand'
import { MicrochipHero } from '@components/auth/MicrochipHero'
import { Button } from '@components/ui/Button'
import { useAuthStore } from '@store/authStore'
import { prefetchEmployeeDashboard } from '@/utils/prefetchEmployeeRoutes'
import { getApiBaseUrl, getGoogleOAuthStartUrl } from '@/config/apiBase'
import axios from 'axios'

type GoogleOAuthConfig = {
  enabled?: boolean
  redirectUri?: string
}

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
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
    <div className="login-page relative">
      <LoginBackground />
      <LoginTopBrand />

      <div className="login-page-scaler relative">
        <div className="relative z-10 grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
          <div className="flex items-center justify-center px-4 py-10 lg:translate-x-10 lg:py-0 lg:pl-16 lg:pr-4">
            <MicrochipHero />
          </div>

          <div className="flex items-center justify-center px-4 pb-10 lg:py-0 lg:pr-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              className="login-card-shell w-full max-w-sm"
            >
              <div className="login-glass rounded-2xl p-8">
                <div className="login-card-content">
                  <div className="mb-5 text-center">
                  <h2 className="login-card-title font-display text-lg font-semibold tracking-tight">
                    Welcome back
                  </h2>
                  <p className="login-card-subtitle mt-1 text-xs">Sign in to your enterprise portal</p>
                </div>

                  <form className="space-y-4" onSubmit={onSubmit} noValidate>
                  <div className="space-y-1">
                    <label className="login-card-label text-xs font-medium">Email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your email"
                        className={`login-input ${errors.email ? 'login-input-error' : ''}`}
                        {...register('email')}
                      />
                    </div>
                    {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="login-card-label text-xs font-medium">Password</label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className={`login-input pr-10 ${errors.password ? 'login-input-error' : ''}`}
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
                  </div>

                  <Button
                    type="submit"
                    className="login-btn-glow h-10 w-full rounded-lg text-sm font-semibold text-white"
                    loading={isSubmitting}
                  >
                    Login
                  </Button>
                </form>

                {googleSignInEnabled ? (
                  <>
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="login-card-subtitle bg-[#f8fafc] px-3">
                          Or continue with
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="login-btn-secondary h-11 w-full gap-3 rounded-lg text-sm font-medium backdrop-blur-sm"
                      loading={googleLoading}
                      onClick={handleGoogleRedirect}
                    >
                      <GoogleMark />
                      Continue with Google
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>  
    </div>
  )
}