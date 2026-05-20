import type { ReactNode } from 'react'

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface/60 p-5">
      <header>
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </header>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}
