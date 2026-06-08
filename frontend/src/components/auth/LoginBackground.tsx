import { useEffect, useRef } from 'react'

const LOGIN_VIDEO_SRC = '/videos/login-bg.mp4'
/** Slower playback for calmer PCB / circuit motion */
const LOGIN_VIDEO_PLAYBACK_RATE = 0.55

type LoginBackgroundProps = {
  variant?: 'login' | 'admin'
}

export function LoginBackground({ variant = 'login' }: LoginBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (variant !== 'login') return
    const video = videoRef.current
    if (!video) return

    const applyPlayback = () => {
      video.playbackRate = LOGIN_VIDEO_PLAYBACK_RATE
    }

    const play = () => {
      applyPlayback()
      void video.play().catch(() => {
        /* autoplay may be blocked until user interaction */
      })
    }

    applyPlayback()
    play()
    video.addEventListener('loadedmetadata', applyPlayback)
    video.addEventListener('canplay', play)
    return () => {
      video.removeEventListener('loadedmetadata', applyPlayback)
      video.removeEventListener('canplay', play)
    }
  }, [variant])

  if (variant === 'admin') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--dash-canvas,#e6ebe8)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(74,222,128,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(187,247,208,0.22),transparent_55%)]" />
      </div>
    )
  }

  return (
    <div className="login-video-bg pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0a0f18]">
      <video
        ref={videoRef}
        className="login-video-bg__media"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src={LOGIN_VIDEO_SRC} type="video/mp4" />
      </video>

      {/* Readability overlays — keep video sharp, soften contrast for UI */}
      <div className="login-video-bg__overlay-left absolute inset-0" />
      <div className="login-video-bg__overlay-right absolute inset-0" />
      <div className="login-video-bg__vignette absolute inset-0" />
    </div>
  )
}
