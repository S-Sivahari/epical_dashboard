import { cn } from '@/utils/cn'

type CompanyLogoProps = {
  className?: string
  alt?: string
}

export function CompanyLogo({ className, alt = 'Epical Layouts' }: CompanyLogoProps) {
  return (
    <img
      src="/pic/logos.png"
      alt={alt}
      className={cn('object-contain', className)}
      draggable={false}
    />
  )
}
