/**
 * Notification sound player utility
 * Uses Web Audio API to generate a simple notification sound
 */

let audioContext: AudioContext | null = null;
let lastSoundTime: number = 0;
const SOUND_COOLDOWN_MS = 500; // Prevent rapid successive sounds
let isInitialized = false;

/**
 * Initialize audio context (requires user interaction)
 * Call this on first user interaction (click, touch, etc)
 */
export function initializeAudioContext(): void {
  if (isInitialized) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Sound] Web Audio API not supported');
      return;
    }

    audioContext = new AudioContextClass();
    isInitialized = true;

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
  } catch (error) {
    console.error('[Sound] Failed to initialize audio context:', error);
  }
}

/**
 * Auto-initialize audio context on first page interaction
 */
if (typeof window !== 'undefined') {
  const initOnInteraction = () => {
    if (!isInitialized) {
      initializeAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', initOnInteraction);
      document.removeEventListener('keydown', initOnInteraction);
      document.removeEventListener('touchstart', initOnInteraction);
    }
  };

  document.addEventListener('click', initOnInteraction, { once: true });
  document.addEventListener('keydown', initOnInteraction, { once: true });
  document.addEventListener('touchstart', initOnInteraction, { once: true });
}

/**
 * Play a notification sound
 * Uses Web Audio API to generate a pleasing notification bell tone
 */
export function playNotificationSound(): void {
  // Debounce rapid notifications
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return;
  }
  lastSoundTime = now;

  try {
    // Initialize if needed
    if (!audioContext) {
      initializeAudioContext();
    }

    if (!audioContext) {
      playFallbackSound();
      return;
    }

    const ctx = audioContext;

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => playTone(ctx));
    } else {
      playTone(ctx);
    }
  } catch (error) {
    console.error('[Sound] Error playing notification sound:', error);
    playFallbackSound();
  }
}

/**
 * Internal function to play the tone
 */
function playTone(ctx: AudioContext): void {
  try {
    const startTime = ctx.currentTime;
    const duration = 0.8; // Longer duration (800ms)

    // Create oscillator for pleasant chime tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Pleasant two-tone chime - more musical and longer
    osc.type = 'sine';
    // First high note (bright start)
    osc.frequency.setValueAtTime(1000, startTime);
    // Quick transition to medium note for body
    osc.frequency.exponentialRampToValueAtTime(800, startTime + 0.15);
    // Subtle fall for natural decay
    osc.frequency.exponentialRampToValueAtTime(700, startTime + duration);

    // Volume envelope - starts moderate, sustains, then fades
    gain.gain.setValueAtTime(0.6, startTime); // Start at 0.6
    gain.gain.setValueAtTime(0.5, startTime + 0.1); // Sustain at 0.5
    gain.gain.exponentialRampToValueAtTime(0.02, startTime + duration); // Long fade out

    // Filter for warm, pleasant tone
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2500, startTime);
    filter.frequency.exponentialRampToValueAtTime(1500, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch (error) {
    console.error('[Sound] Error in playTone:', error);
  }
}

/**
 * Fallback sound using HTML5 audio element
 * Creates a simple beep sound
 */
function playFallbackSound(): void {
  try {
    const audioUrl =
      'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';

    const audio = new Audio(audioUrl);
    audio.volume = 0.7;
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Check if audio is enabled in browser
 */
export function isAudioSupported(): boolean {
  return !!(
    window.AudioContext ||
    (window as any).webkitAudioContext ||
    typeof Audio !== 'undefined'
  );
}

/**
 * Expose debug functions to window for testing in console
 */
if (typeof window !== 'undefined') {
  (window as any).initAudio = initializeAudioContext;
  (window as any).playSound = playNotificationSound;
}
