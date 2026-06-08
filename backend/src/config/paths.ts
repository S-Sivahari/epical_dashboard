import { existsSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Backend package root (…/backend), stable regardless of process.cwd(). */
export const BACKEND_ROOT = join(__dirname, '..', '..')

/** epical_dashboard folder (parent of backend). */
export const PROJECT_ROOT = join(BACKEND_ROOT, '..')

export const PAYROLL_UPLOADS_ROOT = join(BACKEND_ROOT, 'uploads', 'payroll')

export const PAYROLL_TEMPLATE_DIR = join(PAYROLL_UPLOADS_ROOT, 'template')

/** Default payslip logo in uploads (set via admin upload or copy from project root). */
export const COMPANY_LOGO_PATH = join(PAYROLL_TEMPLATE_DIR, 'company_logo.png')

/** Project logo used on payslip PDFs (epical_dashboard/pic/epical_layouts.jpeg). */
export const COMPANY_LOGO_PIC = join(PROJECT_ROOT, 'pic', 'epical_layouts.jpeg')

/** Optional bundled fallback logo shipped with the backend. */
export const COMPANY_LOGO_BUNDLED = join(BACKEND_ROOT, 'src', 'assets', 'company_logo.jpeg')

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

/** Logo placed in epical_dashboard root or pic/ folder. */
export function findProjectRootLogo(): string | null {
  if (!existsSync(PROJECT_ROOT)) return null

  const picPreferred = [
    'epical_layouts.jpeg',
    'epical_layouts.jpg',
    'company_logo.png',
    'company_logo.jpg',
    'company_logo.jpeg',
    'logo.png',
    'logo.jpg',
    'logo.jpeg',
  ]
  for (const name of picPreferred) {
    const p = join(PROJECT_ROOT, 'pic', name)
    if (existsSync(p)) return p
  }

  const preferred = [
    'company_logo.png',
    'company_logo.jpg',
    'company_logo.jpeg',
    'logo.png',
    'logo.jpg',
    'logo.jpeg',
  ]
  for (const name of preferred) {
    const p = join(PROJECT_ROOT, name)
    if (existsSync(p)) return p
  }

  let files: string[] = []
  try {
    files = readdirSync(PROJECT_ROOT).filter((f) => IMAGE_EXT.test(f))
  } catch {
    return null
  }

  const whatsapp = files.find((f) => /whatsapp/i.test(f))
  if (whatsapp) return join(PROJECT_ROOT, whatsapp)

  const epical = files.find((f) => /epical/i.test(f))
  if (epical) return join(PROJECT_ROOT, epical)

  if (files.length === 1) return join(PROJECT_ROOT, files[0])
  return null
}
