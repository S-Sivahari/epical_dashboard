import { type ReactNode } from 'react'
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
  return (
    <label
      className={cn(
        'inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-ui hover:bg-primary/90 sm:w-auto sm:justify-start',
        className,
      )}
    >
        <UploadCloud className="mr-2 h-4 w-4" />
        Choose File
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            onUpload(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
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
