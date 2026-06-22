/** Matches helicopter CSS flyover animation length. */
export const HELICOPTER_FLY_DURATION_MS = 6200

const HELICOPTER_SOUND_PATH = '/sounds/helicopter.wav'

let activeAudio: HTMLAudioElement | null = null

function stopActiveHelicopterAudio() {
  if (!activeAudio) return
  activeAudio.pause()
  activeAudio.currentTime = 0
  activeAudio = null
}

function playSynthesizedHelicopter(durationMs: number): void {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return

  const ctx = new AudioContextClass()
  const start = ctx.currentTime
  const end = start + durationMs / 1000

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, start)
  master.gain.exponentialRampToValueAtTime(0.3, start + 0.4)
  master.gain.setValueAtTime(0.3, end - 0.5)
  master.gain.exponentialRampToValueAtTime(0.0001, end)
  master.connect(ctx.destination)

  const rumble = ctx.createOscillator()
  rumble.type = 'sawtooth'
  rumble.frequency.setValueAtTime(54, start)
  rumble.frequency.linearRampToValueAtTime(48, end)
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0.15
  rumble.connect(rumbleGain).connect(master)
  rumble.start(start)
  rumble.stop(end)

  const rotor = ctx.createOscillator()
  rotor.type = 'triangle'
  rotor.frequency.setValueAtTime(176, start)
  const rotorGain = ctx.createGain()
  rotorGain.gain.value = 0.17

  const chop = ctx.createOscillator()
  chop.type = 'sine'
  chop.frequency.value = 13.6
  const chopDepth = ctx.createGain()
  chopDepth.gain.value = 0.12
  chop.connect(chopDepth)
  chopDepth.connect(rotorGain.gain)

  rotor.connect(rotorGain).connect(master)
  rotor.start(start)
  rotor.stop(end)
  chop.start(start)
  chop.stop(end)

  window.setTimeout(() => {
    void ctx.close()
  }, durationMs + 120)
}

export async function playHelicopterSound(
  durationMs: number = HELICOPTER_FLY_DURATION_MS,
): Promise<void> {
  stopActiveHelicopterAudio()

  try {
    const audio = new Audio(HELICOPTER_SOUND_PATH)
    audio.volume = 0.52
    activeAudio = audio

    const stopTimer = window.setTimeout(() => {
      stopActiveHelicopterAudio()
    }, durationMs)

    audio.addEventListener(
      'ended',
      () => {
        window.clearTimeout(stopTimer)
        activeAudio = null
      },
      { once: true },
    )

    await audio.play()
    return
  } catch {
    stopActiveHelicopterAudio()
  }

  try {
    playSynthesizedHelicopter(durationMs)
  } catch (error) {
    console.warn('[Sound] Failed to play helicopter sound:', error)
  }
}

export function stopHelicopterSound(): void {
  stopActiveHelicopterAudio()
}
