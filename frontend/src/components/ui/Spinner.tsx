import { cn } from '@/utils/cn'

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const map = { sm: 'h-4 w-4 border', md: 'h-5 w-5 border-2', lg: 'h-8 w-8 border-2' }
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-primary/30 border-t-primary',
        map[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  )
}
