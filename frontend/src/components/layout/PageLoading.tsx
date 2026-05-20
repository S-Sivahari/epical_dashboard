import { Spinner } from '@components/ui/Spinner'

export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
