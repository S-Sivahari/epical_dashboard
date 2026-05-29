import { motion } from 'framer-motion'

export function LoginBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#030504] via-[#060a08] to-[#040604]" />

      {/* Radial green glows — brighter to match chip */}
      <div className="absolute -left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-[#00C853]/[0.1] blur-[120px]" />
      <div className="absolute -right-1/4 bottom-1/4 h-[500px] w-[500px] rounded-full bg-[#00e676]/[0.07] blur-[100px]" />
      <div className="absolute right-[10%] top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#00C853]/[0.06] blur-[90px]" />

      {/* Moving light blobs */}
      <motion.div
        className="absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-[#00C853]/[0.08] blur-3xl"
        animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[15%] right-[10%] h-80 w-80 rounded-full bg-[#00e676]/[0.06] blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 30, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Diagonal light rays near form area */}
      <motion.div
        className="absolute right-0 top-0 h-full w-1/2 opacity-[0.04]"
        style={{
          background:
            'repeating-linear-gradient(115deg, transparent, transparent 80px, rgba(0,200,83,0.4) 80px, rgba(0,200,83,0.4) 81px)',
        }}
        animate={{ x: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Light streaks */}
      <motion.div
        className="absolute left-0 top-1/3 h-px w-full bg-gradient-to-r from-transparent via-[#00C853]/25 to-transparent"
        animate={{ opacity: [0.15, 0.55, 0.15], x: ['-5%', '5%', '-5%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-0 top-2/3 h-px w-full bg-gradient-to-r from-transparent via-[#00e676]/15 to-transparent"
        animate={{ opacity: [0.1, 0.45, 0.1], x: ['5%', '-5%', '5%'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Circuit grid */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="login-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00C853" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      {/* Animated circuit lines */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 1200 800" fill="none">
        <motion.path
          d="M0 400 H200 V200 H500 V350 H800 V150 H1200"
          stroke="#00C853"
          strokeWidth="1"
          strokeDasharray="8 12"
          animate={{ strokeDashoffset: [0, -40] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M0 600 H350 V450 H650 V650 H1200"
          stroke="#00e676"
          strokeWidth="0.8"
          strokeDasharray="6 10"
          animate={{ strokeDashoffset: [0, 32] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
        <circle cx="200" cy="400" r="3" fill="#00C853" opacity="0.6" />
        <circle cx="500" cy="200" r="2" fill="#00e676" opacity="0.5" />
        <circle cx="800" cy="350" r="2.5" fill="#00C853" opacity="0.55" />
      </svg>

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]" />

      {/* Floating green particles */}
      {Array.from({ length: 22 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[#00C853]"
          style={{
            width: 1 + (i % 3),
            height: 1 + (i % 3),
            left: `${8 + (i * 4.3) % 88}%`,
            top: `${6 + (i * 6.1) % 88}%`,
            boxShadow: '0 0 6px #00C853, 0 0 10px rgba(0,200,83,0.4)',
          }}
          animate={{
            y: [0, -20 - (i % 4) * 8, 0],
            x: [0, (i % 2 === 0 ? 12 : -12), 0],
            opacity: [0.2, 0.55, 0.2],
          }}
          transition={{
            duration: 6 + (i % 5) * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.25,
          }}
        />
      ))}

      {/* Slow-moving cyber grid overlay */}
      <motion.div
        className="absolute inset-0 opacity-[0.03]"
        animate={{ backgroundPosition: ['0px 0px', '60px 60px'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,200,83,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}
