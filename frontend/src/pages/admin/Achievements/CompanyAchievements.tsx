import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { AchievementCard } from '@components/cards/AchievementCard'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { FileUpload } from '@components/forms/FileUpload'
import { toast } from 'sonner'
import type { Achievement } from '@/types'

const seed: Achievement[] = [
  {
    id: 'A-1',
    title: 'Best Workplace 2026',
    description: 'Recognized for culture, growth, and transparency.',
    createdAt: '2026-01-12',
  },
]

export function CompanyAchievements() {
  const [items, setItems] = useState(seed)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  return (
    <PageWrapper>
      <PageHeader
        title="Achievements"
        breadcrumb={<Breadcrumb items={[{ label: 'Achievements' }]} />}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Add achievement
          </Button>
        }
      />
      <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
        {items.map((a) => (
          <div key={a.id} className="break-inside-avoid">
            <AchievementCard item={a} />
          </div>
        ))}
      </div>

      <Modal isOpen={open} title="Add achievement" onClose={() => setOpen(false)} size="lg">
        <div className="grid gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="text-sm font-medium text-ink">
            Description
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <FileUpload onUpload={() => toast.success('File staged (demo)')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setItems((prev) => [
                  {
                    id: `A-${prev.length + 1}`,
                    title: title || 'Untitled',
                    description: description || '—',
                    createdAt: new Date().toISOString().slice(0, 10),
                  },
                  ...prev,
                ])
                toast.success('Achievement added')
                setOpen(false)
                setTitle('')
                setDescription('')
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
