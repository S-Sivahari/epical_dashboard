import { motion } from 'framer-motion'

const SCRATCH_ANGLES = [12, -18, 37, -42, 68, -55, 23, -31, 81, -12, 44, -63, 15, -72, 52]

type LoginBackgroundProps = {
  variant?: 'login' | 'admin'
}

export function LoginBackground({ variant = 'login' }: LoginBackgroundProps) {
  const isAdmin = variant === 'admin'

  if (isAdmin) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#F8FAF8]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(22,163,74,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(187,247,208,0.4),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_30%_at_50%_50%,rgba(220,252,231,0.5),transparent_70%)]" />
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#161618] via-[#1e1e22] to-[#18181b]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(113,113,122,0.1),transparent_65%)]" />

      <div className="absolute -left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-[#71717a]/[0.06] blur-[120px]" />
      <div className="absolute -right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-[#52525b]/[0.05] blur-[100px]" />

      {/* Crossing scratch grids */}
      <div
        className="absolute inset-[-50%] opacity-[0.045]"
        style={{
          background:
            'repeating-linear-gradient(127deg, transparent, transparent 47px, rgba(161,161,170,0.9) 47px, rgba(161,161,170,0.9) 48px)',
        }}
      />
      <div
        className="absolute inset-[-50%] opacity-[0.035]"
        style={{
          background:
            'repeating-linear-gradient(73deg, transparent, transparent 92px, rgba(113,113,122,0.85) 92px, rgba(113,113,122,0.85) 93px)',
        }}
      />

      {/* Weird angular paths */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <motion.path
          d="M-40 120 L280 640 L520 80 L900 720 L1240 200"
          stroke="#71717a"
          strokeWidth="0.6"
          strokeDasharray="12 18"
          animate={{ strokeDashoffset: [0, -80] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0 500 L180 500 L180 320 L420 320 L420 680 L700 680"
          stroke="#52525b"
          strokeWidth="0.5"
          strokeDasharray="6 14"
          animate={{ strokeDashoffset: [0, 80] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0 180 H120 L200 180 L280 120 L400 120 L480 240 L620 240 L700 160 L860 160 L940 280 L1200 280"
          stroke="#a1a1aa"
          strokeWidth="0.7"
          animate={{ x: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M0 620 H80 L160 560 L300 560 L380 680 L540 680 L620 600 L780 600 L860 720 L1200 720"
          stroke="#71717a"
          strokeWidth="0.6"
          animate={{ x: [0, -25, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>

      {/* Thin lines at odd angles */}
      {SCRATCH_ANGLES.map((deg, i) => (
        <motion.div
          key={deg}
          className="absolute h-px origin-left bg-gradient-to-r from-transparent via-zinc-500/35 to-transparent"
          style={{
            width: `${28 + (i % 5) * 12}%`,
            left: `${(i * 13.7) % 75}%`,
            top: `${(i * 11.3 + 5) % 90}%`,
            rotate: `${deg}deg`,
          }}
          animate={{ opacity: [0.12, 0.4, 0.12], scaleX: [0.85, 1.1, 0.85] }}
          transition={{ duration: 5 + (i % 4) * 2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
        />
      ))}

      <svg className="absolute inset-0 h-full w-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="login-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#71717a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  )
}
