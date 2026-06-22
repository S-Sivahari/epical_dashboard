import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLE_RATE = 44100
const DURATION_SEC = 6.2
const numSamples = Math.floor(SAMPLE_RATE * DURATION_SEC)

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const rand = seededRandom(42)
const samples = new Float32Array(numSamples)

for (let i = 0; i < numSamples; i++) {
  const t = i / SAMPLE_RATE
  const fadeIn = Math.min(1, t / 0.45)
  const fadeOut = Math.min(1, (DURATION_SEC - t) / 0.55)
  const envelope = fadeIn * fadeOut

  const chop = 0.52 + 0.48 * Math.sin(2 * Math.PI * 13.6 * t + Math.sin(t * 1.7) * 0.8)
  const rumble =
    Math.sin(2 * Math.PI * 54 * t) * 0.34 +
    Math.sin(2 * Math.PI * 108 * t) * 0.14 +
    Math.sin(2 * Math.PI * 27 * t) * 0.1
  const rotor = Math.sin(2 * Math.PI * 176 * t) * chop * 0.52
  const tail = Math.sin(2 * Math.PI * 420 * t) * 0.03 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 24 * t))
  const noise = (rand() * 2 - 1) * 0.1 * chop

  samples[i] = Math.max(-1, Math.min(1, (rumble + rotor + tail + noise) * envelope * 0.4))
}

function encodeWav(float32, sampleRate) {
  const bitsPerSample = 16
  const blockAlign = bitsPerSample / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = float32.length * 2
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]))
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2)
  }

  return buffer
}

const outPath = path.resolve(__dirname, '../public/sounds/helicopter.wav')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, encodeWav(samples, SAMPLE_RATE))
console.log(`Wrote ${outPath} (${DURATION_SEC}s)`)
