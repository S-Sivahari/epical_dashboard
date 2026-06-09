/**
 * Plays the app notification sound from /public/sounds/notification.mp3
 */

const NOTIFICATION_SOUND_PATH = '/sounds/notification.mp3'
const SOUND_COOLDOWN_MS = 500
let lastSoundTime = 0

export async function playNotificationSound(): Promise<void> {
  const now = Date.now()
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return
  }
  lastSoundTime = now

  try {
    const audio = new Audio(NOTIFICATION_SOUND_PATH)
    audio.volume = 0.7
    await audio.play()
  } catch (error) {
    console.warn('[Sound] Failed to play notification sound:', error)
  }
}

export function isAudioSupported(): boolean {
  return typeof Audio !== 'undefined'
}
