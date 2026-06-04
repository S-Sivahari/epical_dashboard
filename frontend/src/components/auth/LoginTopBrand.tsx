import { motion } from 'framer-motion'
import { CompanyLogo } from '@components/auth/CompanyLogo'

const COMPANY_WEBSITE = 'https://www.epicallayouts.com/'

export function LoginTopBrand() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="login-top-brand group fixed left-0 top-0 z-30 px-4 py-4 sm:px-5 sm:py-5"
    >
      <a
        href={COMPANY_WEBSITE}
        target="_blank"
        rel="noopener noreferrer"
        className="login-top-brand-link flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-opacity hover:opacity-90 sm:gap-3 sm:px-3"
        aria-label="Epical Layouts — visit company website"
      >
        <CompanyLogo className="login-top-brand-logo h-[3.3rem] w-[3.3rem] shrink-0 sm:h-[3.85rem] sm:w-[3.85rem]" />
        <span className="login-top-brand-text">EPICAL LAYOUTS</span>
      </a>
    </motion.header>
  )
}
