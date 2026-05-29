import { motion } from 'framer-motion'
import { ChipBrandLogo } from '@components/auth/ChipBrandLogo'

export function LoginTopBrand() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="login-top-brand group fixed left-0 top-0 z-30 flex items-center gap-2.5 px-4 py-4 sm:gap-3 sm:px-5 sm:py-5"
    >
      <ChipBrandLogo />
      <span className="login-top-brand-text">EPICAL LAYOUTS</span>
    </motion.header>
  )
}
