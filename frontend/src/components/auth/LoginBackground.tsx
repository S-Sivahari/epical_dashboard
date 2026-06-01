import { motion } from 'framer-motion'

const FANCY_LINE_ANGLES = [8, -14, 22, -28, 35, -41, 52, -58, 67, -73, 81, -88, 96, -103, 115, -122]

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
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#d4d8de]">
      {/* Grey base wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#dde1e7] via-[#d4d8de] to-[#c8cdd4]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,rgba(255,255,255,0.35),transparent_65%)]" />

      {/* Bold diagonal cross-hatch */}
      <div
        className="absolute inset-[-40%] opacity-[0.14]"
        style={{
          background:
            'repeating-linear-gradient(135deg, transparent, transparent 38px, rgba(71,85,105,0.55) 38px, rgba(71,85,105,0.55) 39px)',
        }}
      />
      <div
        className="absolute inset-[-40%] opacity-[0.1]"
        style={{
          background:
            'repeating-linear-gradient(45deg, transparent, transparent 54px, rgba(100,116,139,0.5) 54px, rgba(100,116,139,0.5) 55px)',
        }}
      />
      <div
        className="absolute inset-[-40%] opacity-[0.08]"
        style={{
          background:
            'repeating-linear-gradient(90deg, transparent, transparent 120px, rgba(148,163,184,0.45) 120px, rgba(148,163,184,0.45) 121px)',
        }}
      />

      {/* Large geometric SVG line art */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          d="M-60 80 L220 620 L480 40 L820 780 L1180 120 L1500 640"
          stroke="#475569"
          strokeWidth="1.2"
          strokeDasharray="16 22"
          animate={{ strokeDashoffset: [0, -120] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0 420 L160 420 L160 260 L380 260 L380 560 L620 560 L620 380 L860 380 L860 680 L1100 680"
          stroke="#64748b"
          strokeWidth="1"
          strokeDasharray="8 16"
          animate={{ strokeDashoffset: [0, 96] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0 160 H140 L240 160 L340 80 L520 80 L620 200 L780 200 L880 80 L1060 80 L1160 200 L1440 200"
          stroke="#334155"
          strokeWidth="1.1"
          animate={{ x: [0, 40, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M0 720 H100 L220 620 L400 620 L520 760 L720 760 L840 640 L1040 640 L1160 780 L1440 780"
          stroke="#475569"
          strokeWidth="1"
          animate={{ x: [0, -35, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        />
        <path
          d="M120 0 V900 M360 0 V900 M600 0 V900 M840 0 V900 M1080 0 V900 M1320 0 V900"
          stroke="#94a3b8"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <path
          d="M0 150 H1440 M0 350 H1440 M0 550 H1440 M0 750 H1440"
          stroke="#94a3b8"
          strokeWidth="0.6"
          opacity="0.5"
        />
        <motion.circle
          cx="720"
          cy="450"
          r="280"
          stroke="#64748b"
          strokeWidth="0.8"
          strokeDasharray="4 12"
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '720px 450px' }}
        />
        <motion.circle
          cx="720"
          cy="450"
          r="180"
          stroke="#475569"
          strokeWidth="0.7"
          strokeDasharray="2 10"
          animate={{ rotate: -360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '720px 450px' }}
        />
        <path
          d="M720 170 L920 450 L720 730 L520 450 Z"
          stroke="#64748b"
          strokeWidth="0.9"
          opacity="0.55"
        />
        <path
          d="M200 200 L400 200 L400 400 L200 400 Z M1040 500 L1240 500 L1240 700 L1040 700 Z"
          stroke="#475569"
          strokeWidth="0.8"
          opacity="0.45"
        />
      </svg>

      {/* Corner frame accents */}
      <svg
        className="absolute left-0 top-0 h-48 w-48 opacity-[0.28]"
        viewBox="0 0 120 120"
        fill="none"
      >
        <path d="M8 8 H72 M8 8 V72" stroke="#334155" strokeWidth="1.5" />
        <path d="M20 20 H56 M20 20 V56" stroke="#64748b" strokeWidth="0.8" strokeDasharray="4 6" />
      </svg>
      <svg
        className="absolute right-0 top-0 h-48 w-48 scale-x-[-1] opacity-[0.28]"
        viewBox="0 0 120 120"
        fill="none"
      >
        <path d="M8 8 H72 M8 8 V72" stroke="#334155" strokeWidth="1.5" />
        <path d="M20 20 H56 M20 20 V56" stroke="#64748b" strokeWidth="0.8" strokeDasharray="4 6" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 h-48 w-48 scale-y-[-1] opacity-[0.28]"
        viewBox="0 0 120 120"
        fill="none"
      >
        <path d="M8 8 H72 M8 8 V72" stroke="#334155" strokeWidth="1.5" />
        <path d="M20 20 H56 M20 20 V56" stroke="#64748b" strokeWidth="0.8" strokeDasharray="4 6" />
      </svg>
      <svg
        className="absolute bottom-0 right-0 h-48 w-48 scale-[-1] opacity-[0.28]"
        viewBox="0 0 120 120"
        fill="none"
      >
        <path d="M8 8 H72 M8 8 V72" stroke="#334155" strokeWidth="1.5" />
        <path d="M20 20 H56 M20 20 V56" stroke="#64748b" strokeWidth="0.8" strokeDasharray="4 6" />
      </svg>

      {/* Sweeping angled accent lines */}
      {FANCY_LINE_ANGLES.map((deg, i) => (
        <motion.div
          key={`${deg}-${i}`}
          className="absolute h-[1.5px] origin-left bg-gradient-to-r from-transparent via-slate-600/50 to-transparent"
          style={{
            width: `${32 + (i % 6) * 14}%`,
            left: `${(i * 11.3) % 68}%`,
            top: `${(i * 9.7 + 4) % 88}%`,
            rotate: `${deg}deg`,
          }}
          animate={{ opacity: [0.15, 0.45, 0.15], scaleX: [0.8, 1.15, 0.8] }}
          transition={{
            duration: 4 + (i % 5) * 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.18,
          }}
        />
      ))}

      {/* Fine grid overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="login-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#475569" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      {/* Soft vignette so content stays readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(148,163,184,0.18)_100%)]" />
    </div>
  )
}
