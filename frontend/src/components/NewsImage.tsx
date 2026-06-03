import { useEffect, useState } from 'react'
import { resolveNewsImageSrc, type NewsItem } from '@services/newsService'

export function NewsImage({
  item,
  className = '',
  alt = '',
}: {
  item: Pick<NewsItem, 'id' | 'imageUrl' | 'hasImage' | 'updatedAt'>
  className?: string
  alt?: string
}) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    void (async () => {
      const resolved = await resolveNewsImageSrc(item)
      if (cancelled) {
        if (resolved?.startsWith('blob:')) URL.revokeObjectURL(resolved)
        return
      }
      objectUrl = resolved?.startsWith('blob:') ? resolved : null
      setSrc(resolved)
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, item.imageUrl, item.hasImage, item.updatedAt])

  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setSrc(null)}
    />
  )
}
