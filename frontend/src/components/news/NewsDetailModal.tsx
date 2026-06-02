import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { NewsImage } from '@components/NewsImage'
import { formatDate } from '@/utils/formatDate'
import type { NewsItem } from '@services/newsService'

type NewsDetailModalProps = {
  item: NewsItem | null
  onClose: () => void
  onEdit?: (item: NewsItem) => void
}

export function NewsDetailModal({ item, onClose, onEdit }: NewsDetailModalProps) {
  if (!item) return null

  const hasImage = Boolean(item.imageUrl || item.hasImage)

  return (
    <Modal isOpen={!!item} onClose={onClose} title={item.title} size="lg">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-5"
      >
        <p className="text-sm text-muted">{formatDate(item.publishedAt)}</p>

        {hasImage ? (
          <NewsImage item={item} alt={item.title} className="max-h-80 w-full rounded-xl object-cover" />
        ) : null}

        <div className="rounded-lg bg-surface/50 p-4">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            {item.content?.trim() || item.excerpt?.trim() || 'No description available.'}
          </p>
        </div>

        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <span>View link</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {onEdit ? (
            <Button onClick={() => onEdit(item)}>Edit</Button>
          ) : null}
        </div>
      </motion.div>
    </Modal>
  )
}
