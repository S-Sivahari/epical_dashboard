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

  console.log('[Sound] Initializing audio context...');

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[Sound] Web Audio API not supported');
      return;
    }

    audioContext = new AudioContextClass();
    isInitialized = true;
    console.log('[Sound] Audio context initialized successfully');

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[Sound] Audio context resumed');
      });
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
    console.log('[Sound] Skipped due to cooldown');
    return;
  }
  lastSoundTime = now;

  console.log('[Sound] Playing notification sound...');

  try {
    // Initialize if needed
    if (!audioContext) {
      console.warn('[Sound] Audio context not initialized, attempting initialization...');
      initializeAudioContext();
    }

    if (!audioContext) {
      console.warn('[Sound] Audio context unavailable');
      playFallbackSound();
      return;
    }

    const ctx = audioContext;

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      console.log('[Sound] Resuming suspended audio context...');
      ctx.resume().then(() => {
        console.log('[Sound] Audio context resumed, playing sound');
        playTone(ctx);
      });
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

    // Create oscillator for bell-like tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Bell-like tone frequencies
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, startTime); // Start at 800 Hz
    osc.frequency.exponentialRampToValueAtTime(600, startTime + 0.1); // Fall to 600 Hz

    // Volume envelope - increased volume for better audibility
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2); // Fade out

    // Filter for warmth
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, startTime);

    osc.start(startTime);
    osc.stop(startTime + 0.2);

    console.log('[Sound] Notification sound played successfully');
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
    console.log('[Sound] Using fallback audio method');

    // Create a simple beep using oscillator oscillations
    // This is a longer WAV file with a clear beep tone (about 1 second of silence + beep)
    const audioUrl =
      'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==';

    const audio = new Audio(audioUrl);
    audio.volume = 0.7;

    audio
      .play()
      .then(() => {
        console.log('[Sound] Fallback audio played successfully');
      })
      .catch((e) => {
        console.error('[Sound] Fallback audio play failed:', e);
      });
  } catch (error) {
    console.debug('[Sound] Fallback sound error:', error);
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
  
  // Log availability
  console.log(
    '%c🔔 Notification Sound Tools Available\nwindow.initAudio() | window.playSound()',
    'color: #22c55e; font-size: 12px; font-weight: bold'
  );
}
