import { Volume2, Music } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { playNotificationSound, isAudioSupported } from '@utils/notificationSound'

export function NotificationSoundSettings() {
  const handlePlayTest = async () => {
    await playNotificationSound()
  }

  if (!isAudioSupported()) {
    return (
      <div className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">Audio is not supported on your browser.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-white p-5">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Notification Sound</h3>
        <p className="text-xs text-muted">
          Notifications use the app sound at <code className="text-ink">/sounds/notification.mp3</code>.
        </p>
      </div>

      <div className="space-y-3 rounded-lg bg-emerald-50 p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">notification.mp3</p>
            <p className="text-xs text-muted">Default notification sound</p>
          </div>
          <Music className="h-5 w-5 shrink-0 text-primary" />
        </div>

        <Button size="sm" variant="secondary" onClick={handlePlayTest} className="w-full">
          <Volume2 className="h-4 w-4" />
          Test Sound
        </Button>
      </div>
    </div>
  )
}
