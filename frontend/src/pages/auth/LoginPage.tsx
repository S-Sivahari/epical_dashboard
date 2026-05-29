import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { useAuthStore } from '@store/authStore'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'
import { getGoogleClientId } from '@services/googleOAuthService'
import { prefetchEmployeeDashboard } from '@/utils/prefetchEmployeeRoutes'

const LOGO_URL = '/logo.png'
const googleClientId = getGoogleClientId()
const googleSignInEnabled = googleClientId.endsWith('.apps.googleusercontent.com')

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

// EPICAL LAYOUTS logo using actual image
function EpicalLogo({ className = 'h-12 w-12' }: { className?: string }) {
  return <img src={LOGO_URL} alt="Epical Layouts" className={className} />
}

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const completeOAuthRedirect = useAuthStore((s) => s.completeOAuthRedirect)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (token) {
      const oauthRole = params.get('role') ?? 'employee'
      const email = params.get('email') ?? ''
      const name = params.get('name') ?? email.split('@')[0]
      const designation = params.get('designation') ?? undefined

      completeOAuthRedirect({ token, role: oauthRole, email, name, designation })
      prefetchEmployeeDashboard()
      window.history.replaceState({}, '', '/auth/login')
      navigate(oauthRole === 'admin' ? '/admin' : '/employee', { replace: true })
      return
    }

    const error = params.get('error')
    if (error) {
      window.history.replaceState({}, '', '/auth/login')
      toast.error(
        error === 'google_auth_failed'
          ? 'Google sign-in failed or this email is not registered. Contact HR or use email/password.'
          : 'Sign-in failed. Please try again.',
      )
    }
  }, [completeOAuthRedirect, navigate])

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
      const message = error instanceof Error ? error.message : 'Unable to sign in'
      toast.error(message)
    }
  })

  const handleGoogleRedirect = () => {
    setGoogleLoading(true)
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api'
    window.location.assign(`${apiBase}/auth/google`)
  }

  return (
    <div className="relative grid h-screen overflow-hidden lg:grid-cols-2">
      {/* ─── Left Panel: Branding ─── */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0a3d2f] via-[#0d4a3a] to-[#06301f] p-12 text-white lg:flex"
        style={{ clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0 100%)' }}
      >
        {/* Diagonal accent stripe */}
        <div className="pointer-events-none absolute -right-10 bottom-0 h-full w-24 -translate-x-8 -rotate-[8deg] rounded-l-full bg-gradient-to-t from-emerald-500/60 to-emerald-400/30 blur-sm" />
        <div className="pointer-events-none absolute -right-4 bottom-0 h-[80%] w-20 -translate-x-8 -rotate-[8deg] rounded-l-full bg-emerald-400/40 blur-md" />

        {/* Subtle circuit-line decorations */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <svg className="h-full w-full" viewBox="0 0 800 800" fill="none">
            <path d="M200 100h300M300 100v200M300 300h400M500 200v300M100 400h250M250 400v200M250 600h350" stroke="#fff" strokeWidth="1" />
            <circle cx="200" cy="100" r="2" fill="#fff" />
            <circle cx="300" cy="100" r="2" fill="#fff" />
            <circle cx="300" cy="300" r="2" fill="#fff" />
            <circle cx="500" cy="200" r="2" fill="#fff" />
            <circle cx="500" cy="500" r="2" fill="#fff" />
          </svg>
        </div>

        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/[0.03]" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/[0.02]" />

        {/* Logo + Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <EpicalLogo className="h-11 w-11" />
            <span className="text-sm font-semibold tracking-widest text-white/80">EPICAL LAYOUTS</span>
          </div>
        </div>

        {/* Hero text - centered vertically */}
        <div className="relative z-10 space-y-3">
          <h1 className="font-display text-6xl font-extrabold leading-none tracking-tight text-white">
            {APP_SHORT_NAME}
            <span className="mt-1 block h-1 w-20 rounded-full bg-emerald-400" />
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-emerald-100/70">
            {APP_NAME}
          </p>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex items-center justify-center bg-[#f7f8fa] px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-lg shadow-black/[0.04]"
        >
          {/* Logo + Title */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-2 flex justify-center">
              <EpicalLogo className="h-10 w-10" />
            </div>
            <p className="mb-3 text-[10px] font-semibold tracking-widest text-muted">EPICAL LAYOUTS</p>
            <h2 className="font-display text-xl font-bold text-ink">Welcome back</h2>
            <p className="mt-0.5 text-xs text-muted">Sign in to your enterprise portal</p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  className={`h-10 w-full rounded-lg border bg-white pl-10 pr-3 text-sm text-ink shadow-sm outline-none transition-all placeholder:text-muted/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-border'
                  }`}
                  {...register('email')}
                />
              </div>
              {errors.email ? <p className="text-xs text-red-500">{errors.email.message}</p> : null}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`h-10 w-full rounded-lg border bg-white pl-10 pr-10 text-sm text-ink shadow-sm outline-none transition-all placeholder:text-muted/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-border'
                  }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? <p className="text-xs text-red-500">{errors.password.message}</p> : null}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <button type="button" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                Forgot password?
              </button>
            </div>

            {/* Login button */}
            <Button
              type="submit"
              className="h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
              loading={isSubmitting}
            >
              Login
            </Button>
          </form>

          {/* Google sign-in */}
          {googleSignInEnabled ? (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-muted">Or continue with</span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full gap-3 rounded-lg text-sm font-medium"
                loading={googleLoading}
                onClick={handleGoogleRedirect}
              >
                <GoogleMark />
                Continue with Google
              </Button>
            </>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}
