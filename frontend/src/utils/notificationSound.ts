const DEFAULT_SOUND_PATH = '/sounds/notification.mp3';
const SOUND_COOLDOWN_MS = 500;

let lastSoundTime = 0;
let defaultAudio: HTMLAudioElement | null = null;

function getDefaultAudio(): HTMLAudioElement {
  if (!defaultAudio) {
    defaultAudio = new Audio(DEFAULT_SOUND_PATH);
    defaultAudio.preload = 'auto';
    defaultAudio.volume = 0.7;
  }
  return defaultAudio;
}

export function preloadNotificationSound(): void {
  void getDefaultAudio().load();
}

export async function playNotificationSound(): Promise<void> {
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return;
  }
  lastSoundTime = now;

  try {
    const audio = getDefaultAudio();
    audio.currentTime = 0;
    await audio.play();
  } catch {
    try {
      const fresh = new Audio(DEFAULT_SOUND_PATH);
      fresh.volume = 0.7;
      await fresh.play();
    } catch (error) {
      console.warn('[Sound] Could not play notification.mp3:', error);
    }
  }
}

export function isAudioSupported(): boolean {
  return typeof Audio !== 'undefined';
}

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('custom-notification-sound');
  } catch {
    /* ignore */
  }

  (window as Window & { testSound?: () => void }).testSound = () => {
    void playNotificationSound();
  };
}
