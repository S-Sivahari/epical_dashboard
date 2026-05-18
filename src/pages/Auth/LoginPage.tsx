import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { useAuthStore } from '@store/authStore'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Enter your password'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
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
    } catch {
      toast.error('Unable to sign in')
    }
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-10 text-white lg:flex">
        <div>
          <p className="font-display text-2xl font-bold">HRMS</p>
          <p className="mt-3 max-w-md text-sm text-emerald-50">
            A modern admin experience for people operations — leaves, documents, analytics, and more
            in one place.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-sm text-emerald-50">
            “Clarity for HR teams, confidence for employees.”
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">
              H
            </div>
            <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in to the enterprise portal</p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit} noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Login
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
