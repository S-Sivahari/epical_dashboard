import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const badge = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      success: 'bg-emerald-50 text-emerald-800',
      warning: 'bg-amber-50 text-amber-800',
      danger: 'bg-red-50 text-red-700',
      info: 'bg-blue-50 text-blue-700',
      neutral: 'bg-surface text-muted',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export function Badge({
  className,
  variant,
  children,
}: { children: React.ReactNode; className?: string } & VariantProps<typeof badge>) {
  return <span className={cn(badge({ variant }), className)}>{children}</span>
}
