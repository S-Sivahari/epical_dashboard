import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { PageLoading } from '@components/layout/PageLoading'

export function AuthLayout() {
  return (
    <div className="auth-layout-scroll min-h-screen">
      <Suspense fallback={<PageLoading />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
