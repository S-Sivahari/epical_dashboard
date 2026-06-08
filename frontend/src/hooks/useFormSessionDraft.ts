import { useEffect, useRef } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import {
  clearFormSessionDraft,
  hasFormDraftContent,
  readFormSessionDraft,
  writeFormSessionDraft,
} from '@/utils/formSessionDraft'

type UseFormSessionDraftOptions<T extends FieldValues> = {
  /** Skip automatic restore on mount (e.g. edit forms that load server data first). */
  skipHydrate?: boolean
  /** Values treated as empty so defaults alone do not create a draft. */
  defaultValues?: Partial<T>
}

export function useFormSessionDraft<T extends FieldValues>(
  key: string,
  { reset, watch }: Pick<UseFormReturn<T>, 'reset' | 'watch'>,
  options?: UseFormSessionDraftOptions<T>,
) {
  const hydrated = useRef(false)
  const defaultsRef = useRef((options?.defaultValues ?? {}) as Record<string, unknown>)
  defaultsRef.current = (options?.defaultValues ?? {}) as Record<string, unknown>

  useEffect(() => {
    if (options?.skipHydrate || hydrated.current) return
    hydrated.current = true
    const saved = readFormSessionDraft<T>(key)
    if (saved) {
      reset(saved, { keepDefaultValues: false })
    }
  }, [key, reset, options?.skipHydrate])

  useEffect(() => {
    const subscription = watch((values) => {
      const record = values as Record<string, unknown>
      if (hasFormDraftContent(record, defaultsRef.current)) {
        writeFormSessionDraft(key, values)
      } else {
        clearFormSessionDraft(key)
      }
    })
    return () => subscription.unsubscribe()
  }, [key, watch])

  return {
    clearDraft: () => clearFormSessionDraft(key),
    readDraft: () => readFormSessionDraft<T>(key),
  }
}
