import { motion } from 'framer-motion'

type ChipBrandLogoProps = {
  className?: string
}

function ChipLogoSvg({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer frame */}
      <rect x="10" y="10" width="44" height="44" rx="5" stroke="#00C853" strokeWidth="2" opacity="0.85" />
      {/* Corner pins */}
      {[14, 32, 50].map((pos) => (
        <g key={`pin-${pos}`}>
          <rect x={pos - 1.5} y="4" width="3" height="6" rx="0.5" fill="#00C853" opacity="0.9" />
          <rect x={pos - 1.5} y="54" width="3" height="6" rx="0.5" fill="#00C853" opacity="0.9" />
          <rect x="4" y={pos - 1.5} width="6" height="3" rx="0.5" fill="#00C853" opacity="0.9" />
          <rect x="54" y={pos - 1.5} width="6" height="3" rx="0.5" fill="#00C853" opacity="0.9" />
        </g>
      ))}
      {/* Circuit traces */}
      <path
        d="M18 32 H28 V22 H36 V32 H46 M32 32 V42"
        stroke="#00e676"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {/* Core */}
      <rect x="26" y="26" width="12" height="12" rx="2" stroke="#00C853" strokeWidth="1.5" fill="#00C853" fillOpacity="0.25" />
      <rect x="29" y="29" width="6" height="6" rx="1" fill="#00C853" opacity="0.95" />
    </svg>
  )
}

export function ChipBrandLogo({ className = 'h-9 w-9 sm:h-10 sm:w-10' }: ChipBrandLogoProps) {
  return (
    <motion.div
      className="relative inline-flex shrink-0 items-center justify-center"
      whileHover={{ scale: 1.08 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <motion.div
        className="pointer-events-none absolute inset-[-40%] rounded-full bg-[#00C853]/25 blur-lg"
        animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.9, 1.12, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />

      <motion.div
        className="chip-brand-logo relative z-10"
        animate={{
          filter: [
            'drop-shadow(0 0 4px rgba(0,200,83,0.8)) drop-shadow(0 0 12px rgba(0,200,83,0.4))',
            'drop-shadow(0 0 8px rgba(0,230,118,0.95)) drop-shadow(0 0 20px rgba(0,200,83,0.55))',
            'drop-shadow(0 0 4px rgba(0,200,83,0.8)) drop-shadow(0 0 12px rgba(0,200,83,0.4))',
          ],
        }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChipLogoSvg className={className} />
      </motion.div>
    </motion.div>
  )
}
