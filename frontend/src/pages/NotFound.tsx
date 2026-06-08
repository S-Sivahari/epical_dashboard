import { Link } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { useAuthStore } from '@store/authStore'

export function NotFound() {
  const role = useAuthStore((s) => s.role)
  const home = role === 'admin' ? '/admin' : role === 'employee' ? '/employee' : '/auth/login'

  return (
    <PageWrapper scrollable>
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="font-display text-6xl font-bold text-primary">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you are looking for does not exist or was moved.</p>
        <Button asChild className="mt-6">
          <Link to={home}>Back to home</Link>
        </Button>
      </div>
    </PageWrapper>
  )
}
