/**
 * Custom Notification Sound Manager
 * Allows users to upload and use custom notification sounds
 * Falls back to default sound from /public/sounds/notification.mp3
 */

const STORAGE_KEY = 'custom-notification-sound';
const DEFAULT_SOUND_PATH = '/sounds/notification.mp3'; // Place your sound file here
const SOUND_COOLDOWN_MS = 500;
let lastSoundTime: number = 0;
let defaultSoundCache: string | null = null;
let defaultSoundLoadAttempted = false;

interface StoredSound {
  fileName: string;
  mimeType: string;
  data: string; // base64 encoded
}

/**
 * Load default notification sound from public folder
 */
async function loadDefaultSound(): Promise<string | null> {
  if (defaultSoundLoadAttempted && defaultSoundCache === null) {
    return null; // Already tried and failed
  }

  if (defaultSoundCache) {
    return defaultSoundCache;
  }

  try {
    const response = await fetch(DEFAULT_SOUND_PATH);
    if (!response.ok) {
      console.warn(`[Sound] Failed to load default sound: ${response.status}`);
      defaultSoundLoadAttempted = true;
      return null;
    }

    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onload = () => {
        const dataUrl = reader.result as string;
        defaultSoundCache = dataUrl;
        defaultSoundLoadAttempted = true;
        console.log('[Sound] Default sound loaded from', DEFAULT_SOUND_PATH);
        resolve(dataUrl);
      };

      reader.onerror = () => {
        console.warn('[Sound] Failed to read default sound file');
        defaultSoundLoadAttempted = true;
        resolve(null);
      };

      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[Sound] Error loading default sound:', error);
    defaultSoundLoadAttempted = true;
    return null;
  }
}

/**
 * Get the stored custom notification sound
 */
export function getCustomNotificationSound(): StoredSound | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('[CustomSound] Error reading stored sound:', error);
    return null;
  }
}

/**
 * Save a custom notification sound
 * @param file The audio file to save
 */
export async function saveCustomNotificationSound(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const base64Data = reader.result as string;
        const soundData: StoredSound = {
          fileName: file.name,
          mimeType: file.type,
          data: base64Data,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(soundData));
        console.log('[CustomSound] Sound saved:', file.name);
        resolve();
      } catch (error) {
        reject(new Error(`Failed to save sound: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Delete the custom notification sound
 */
export function deleteCustomNotificationSound(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[CustomSound] Sound deleted');
  } catch (error) {
    console.error('[CustomSound] Error deleting sound:', error);
  }
}

/**
 * Play custom sound → default sound → generated chime (fallback)
 */
export async function playCustomNotificationSound(): Promise<void> {
  // Debounce rapid notifications
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return;
  }
  lastSoundTime = now;

  try {
    // 1. Try custom sound first
    const customSound = getCustomNotificationSound();
    if (customSound?.data) {
      try {
        const audio = new Audio(customSound.data);
        audio.volume = 0.7;
        await audio.play();
        console.log('[Sound] Playing custom notification sound:', customSound.fileName);
        return;
      } catch (error) {
        console.warn('[Sound] Failed to play custom sound, trying default:', error);
      }
    }

    // 2. Try default sound from public folder
    const defaultSound = await loadDefaultSound();
    if (defaultSound) {
      try {
        const audio = new Audio(defaultSound);
        audio.volume = 0.7;
        await audio.play();
        console.log('[Sound] Playing default notification sound');
        return;
      } catch (error) {
        console.warn('[Sound] Failed to play default sound, falling back to generated chime:', error);
      }
    }

    // 3. Fallback to generated chime
    playGeneratedChimeSound();
  } catch (error) {
    console.error('[Sound] Error in playCustomNotificationSound:', error);
    // Final fallback: play generated chime
    playGeneratedChimeSound();
  }
}

/**
 * Play a generated chime sound (fallback)
 */
function playGeneratedChimeSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Sound] Web Audio API not supported');
      return;
    }

    const audioContext = new AudioContextClass();
    const startTime = audioContext.currentTime;
    const duration = 0.8;

    // Create oscillator for pleasant chime tone
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    // Pleasant two-tone chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, startTime);
    osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(700, startTime + duration);

    // Volume envelope
    gain.gain.setValueAtTime(0.6, startTime);
    gain.gain.setValueAtTime(0.5, startTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.02, startTime + duration);

    // Filter for warm tone
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, startTime);
    filter.frequency.exponentialRampToValueAtTime(1500, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);

    console.log('[Sound] Playing generated chime sound');
  } catch (error) {
    console.error('[Sound] Error playing generated sound:', error);
  }
}

/**
 * Check if audio is supported
 */
export function isAudioSupported(): boolean {
  return !!(
    window.AudioContext ||
    (window as any).webkitAudioContext ||
    typeof Audio !== 'undefined'
  );
}

/**
 * Expose debug functions to window for testing
 */
if (typeof window !== 'undefined') {
  (window as any).playCustomSound = playCustomNotificationSound;
  (window as any).getCustomSound = getCustomNotificationSound;
  (window as any).deleteCustomSound = deleteCustomNotificationSound;
}
