import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/utils/cn'

export function NavbarSearch({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className={cn('vuexy-navbar-search relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search"
        className="vuexy-navbar-search-input h-9 w-full min-w-0 pl-9 pr-[4.5rem] text-sm"
        aria-label="Search"
      />
      <kbd className="vuexy-kbd pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
        CTRL + K
      </kbd>
    </div>
  )
}
