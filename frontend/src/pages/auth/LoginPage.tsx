import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import { Cpu, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '@store/authStore'
import { APP_SHORT_NAME } from '@/utils/constants'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Enter your password'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loginWithOAuth = useAuthStore((s) => s.loginWithOAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()

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
      toast.success('Welcome back')
      const userRole = useAuthStore.getState().role
      navigate(userRole === 'admin' ? '/admin' : '/employee', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in'
      toast.error(message)
    }
  })

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    try {
      if (!credentialResponse.credential) throw new Error('Missing Google credential')
      const decoded = jwtDecode<{ email: string; name: string; sub: string }>(credentialResponse.credential)
      await loginWithOAuth(decoded.email, decoded.name, decoded.sub)
      toast.success('Welcome back')
      const userRole = useAuthStore.getState().role
      navigate(userRole === 'admin' ? '/admin' : '/employee', { replace: true })
    } catch (error) {
      console.error('Google login error:', error)
      const message = error instanceof Error ? error.message : 'Unable to sign in with Google'
      toast.error(message)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef1f0] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-white p-8 shadow-[0_18px_50px_-20px_rgba(16,24,20,0.25)]"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md">
            <Cpu className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-emerald-800">{APP_SHORT_NAME}</h1>
        </div>

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
                  errors.email ? 'border-red-400' : 'border-border'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className={`h-11 w-full rounded-xl border bg-white pl-10 pr-3 text-sm text-ink outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
                  errors.password ? 'border-red-400' : 'border-border'
                }`}
                {...register('password')}
              />
            </div>
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-800 disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In with Email'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-white px-3 text-muted">Or</span>
          </div>
        </div>

        <div className="flex justify-center [&>div]:w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => toast.error('Google login failed')}
            text="continue_with"
            size="large"
            theme="outline"
            shape="rectangular"
            width="100%"
          />
        </div>
      </motion.div>

      <p className="mt-8 text-center text-xs text-muted">
        © Epical Layouts™ {new Date().getFullYear()} — All rights reserved
      </p>
    </div>
  )
}
