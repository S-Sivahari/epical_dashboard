/**
 * Browser console test helper for notification sound
 * Add this to window for debugging in console
 */

import { playNotificationSound } from '@utils/notificationSound'

export function setupSoundDebug() {
  // Add to window for console testing
  ;(window as any).testSound = () => {
    console.log('Testing notification sound...')
    void playNotificationSound()
  }

  console.log(
    '%c🔔 Notification Sound Debug Tools Ready',
    'color: green; font-size: 14px; font-weight: bold',
  )
  console.log('Available commands:')
  console.log('  window.testSound() - Play test notification sound')
}
