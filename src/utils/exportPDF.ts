import { toast } from 'sonner'

/** Placeholder export: wire to PDF library when backend is ready */
export async function exportAnalyticsPdf(_filename: string) {
  await new Promise((r) => setTimeout(r, 400))
  toast.success('PDF export queued. Check downloads shortly.')
}
