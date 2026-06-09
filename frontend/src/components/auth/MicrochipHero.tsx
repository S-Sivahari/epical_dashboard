import { motion } from 'framer-motion'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'

export function MicrochipHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative flex w-full max-w-lg flex-col items-center px-4 text-center lg:items-start lg:text-left"
    >
      <div className="space-y-4">
        <h1 className="font-display text-[2.025rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-[2.7rem] lg:text-[3.375rem]">
          {APP_SHORT_NAME}
          <motion.span
            className="mt-2 block h-1 w-[3.6rem] rounded-full bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.5)]"
            animate={{ width: ['3.6rem', '4.5rem', '3.6rem'], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </h1>
        <p className="max-w-md text-[0.9rem] leading-relaxed text-slate-200 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:text-[1.0125rem] lg:text-[1.125rem]">
          {APP_NAME}
        </p>
      </div>
    </motion.div>
  )
}
