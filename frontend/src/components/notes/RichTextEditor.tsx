import { useEffect, useRef } from 'react'
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { cn } from '@/utils/cn'

type Props = {
  label?: string
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

function isEditorEmpty(html: string): boolean {
  const stripped = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return stripped.length === 0
}

export function RichTextEditor({
  label = 'Description',
  value,
  onChange,
  placeholder = 'Write notes for this item…',
  disabled = false,
  id = 'notes-rich-text',
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || ''
    }
  }, [value])

  const applyCommand = (command: string, commandValue?: string) => {
    if (disabled) return
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    onChange(editorRef.current?.innerHTML || '')
  }

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || '')
  }

  const showPlaceholder = isEditorEmpty(value)

  return (
    <div className="admin-notes-field">
      <span className="admin-notes-field__label">{label}</span>
      <div className={cn('admin-notes-rich-text', disabled && 'admin-notes-rich-text--disabled')}>
        <div className="admin-notes-rich-text__toolbar" role="toolbar" aria-label="Description formatting">
          <button type="button" title="Bold" disabled={disabled} onClick={() => applyCommand('bold')}>
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" title="Italic" disabled={disabled} onClick={() => applyCommand('italic')}>
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" title="Underline" disabled={disabled} onClick={() => applyCommand('underline')}>
            <Underline className="h-4 w-4" />
          </button>
          <span className="admin-notes-rich-text__divider" aria-hidden />
          <button
            type="button"
            title="Bullet list"
            disabled={disabled}
            onClick={() => applyCommand('insertUnorderedList')}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Numbered list"
            disabled={disabled}
            onClick={() => applyCommand('insertOrderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>
        <div className="admin-notes-rich-text__editor-wrap">
          {showPlaceholder ? (
            <div className="admin-notes-rich-text__placeholder" aria-hidden>
              {placeholder}
            </div>
          ) : null}
          <div
            id={id}
            ref={editorRef}
            className="admin-notes-rich-text__editor"
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={handleInput}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
          />
        </div>
      </div>
    </div>
  )
}

export function RichTextContent({ html, className }: { html: string; className?: string }) {
  if (!html || isEditorEmpty(html)) return null
  return (
    <div
      className={cn('admin-notes-rich-text__content', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
