const HELICOPTER_SOUND_PATH = '/sounds/helicopter.mp3'
let activeContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!activeContext) activeContext = new AudioContextClass()
  return activeContext
}

function playSynthesizedHelicopter(durationMs: number): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const start = ctx.currentTime
  const end = start + durationMs / 1000

  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, start)
  master.gain.exponentialRampToValueAtTime(0.28, start + 0.35)
  master.gain.setValueAtTime(0.28, end - 0.45)
  master.gain.exponentialRampToValueAtTime(0.0001, end)
  master.connect(ctx.destination)

  const rumble = ctx.createOscillator()
  rumble.type = 'sawtooth'
  rumble.frequency.setValueAtTime(62, start)
  rumble.frequency.linearRampToValueAtTime(54, end)
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0.14
  rumble.connect(rumbleGain).connect(master)
  rumble.start(start)
  rumble.stop(end)

  const rotor = ctx.createOscillator()
  rotor.type = 'triangle'
  rotor.frequency.setValueAtTime(168, start)
  const rotorGain = ctx.createGain()
  rotorGain.gain.value = 0.16

  const chop = ctx.createOscillator()
  chop.type = 'sine'
  chop.frequency.value = 13.5
  const chopDepth = ctx.createGain()
  chopDepth.gain.value = 0.11
  chop.connect(chopDepth)
  chopDepth.connect(rotorGain.gain)

  rotor.connect(rotorGain).connect(master)
  rotor.start(start)
  rotor.stop(end)
  chop.start(start)
  chop.stop(end)

  const whir = ctx.createOscillator()
  whir.type = 'square'
  whir.frequency.setValueAtTime(240, start)
  whir.frequency.exponentialRampToValueAtTime(190, end)
  const whirGain = ctx.createGain()
  whirGain.gain.value = 0.04
  whir.connect(whirGain).connect(master)
  whir.start(start)
  whir.stop(end)
}

export async function playHelicopterSound(durationMs = 5800): Promise<void> {
  try {
    const audio = new Audio(HELICOPTER_SOUND_PATH)
    audio.volume = 0.55
    await audio.play()
    return
  } catch {
    /* fall through to synthesized rotor sound */
  }

  try {
    const ctx = getAudioContext()
    if (ctx?.state === 'suspended') {
      await ctx.resume()
    }
    playSynthesizedHelicopter(durationMs)
  } catch (error) {
    console.warn('[Sound] Failed to play helicopter sound:', error)
  }
}
