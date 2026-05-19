import { useCallback, useState, type DragEvent, type ReactNode } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/utils/cn'

export function FileUpload({
  onUpload,
  accept,
  multiple,
  className,
}: {
  onUpload: (files: FileList | null) => void
  accept?: string
  multiple?: boolean
  className?: string
}) {
  const [over, setOver] = useState(false)
  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setOver(false)
      onUpload(e.dataTransfer.files)
    },
    [onUpload],
  )
  return (
    <div
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white p-8 text-center transition-ui hover:border-primary/50 hover:bg-surface',
        over && 'border-primary bg-emerald-50/40',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <UploadCloud className="mb-2 h-8 w-8 text-primary" />
      <p className="text-sm font-medium text-ink">Drag & drop files here</p>
      <p className="mt-1 text-xs text-muted">or click to browse</p>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="mt-4 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        onChange={(e) => onUpload(e.target.files)}
      />
    </div>
  )
}

export function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  )
}
