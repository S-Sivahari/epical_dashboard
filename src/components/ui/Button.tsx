import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from '@components/ui/Spinner'

const variants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-green-700',
        secondary:
          'border border-border bg-white text-ink hover:bg-surface',
        danger: 'bg-danger text-white hover:bg-red-600',
        ghost: 'text-ink hover:bg-surface',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  loading?: boolean
  icon?: ReactNode
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, children, disabled, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref as never}
        className={cn(variants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-disabled={asChild ? disabled || loading : undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Spinner size="sm" /> : icon}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
