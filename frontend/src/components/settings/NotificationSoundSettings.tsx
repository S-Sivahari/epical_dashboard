import { useState, useEffect } from 'react'
import { Trash2, Upload, Volume2, Music } from 'lucide-react'
import { Button } from '@components/ui/Button'
import {
  getCustomNotificationSound,
  saveCustomNotificationSound,
  deleteCustomNotificationSound,
  playCustomNotificationSound,
  isAudioSupported,
} from '@utils/customNotificationSound'

export function NotificationSoundSettings() {
  const [customSound, setCustomSound] = useState(() => getCustomNotificationSound())
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [defaultSoundExists, setDefaultSoundExists] = useState(false)

  // Check if default sound exists on mount
  useEffect(() => {
    const checkDefaultSound = async () => {
      try {
        const response = await fetch('/sounds/notification.mp3', { method: 'HEAD' })
        setDefaultSoundExists(response.ok)
      } catch {
        setDefaultSoundExists(false)
      }
    }
    checkDefaultSound()
  }, [])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a']
    if (!validTypes.includes(file.type)) {
      setError(`Invalid file type. Please upload an audio file (MP3, WAV, OGG, AAC, M4A)`)
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      await saveCustomNotificationSound(file)
      setCustomSound(getCustomNotificationSound())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(`Failed to save sound: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setUploading(false)
      // Reset file input
      event.target.value = ''
    }
  }

  const handleDelete = () => {
    if (!customSound) return

    try {
      deleteCustomNotificationSound()
      setCustomSound(null)
      setError(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(`Failed to delete sound: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handlePlayTest = async () => {
    try {
      await playCustomNotificationSound()
    } catch (err) {
      setError(`Failed to play sound: ${err instanceof Error ? err.message : String(err)}`)
    }
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
          Upload a custom audio file to use as your notification sound. Leave empty to use the default chime.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">
          ✓ Changes saved successfully
        </div>
      )}

      <div className="space-y-3">
        {customSound ? (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{customSound.fileName}</p>
                <p className="text-xs text-muted">Custom notification sound active</p>
              </div>
              <Volume2 className="h-5 w-5 shrink-0 text-primary" />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePlayTest}
                className="flex-1"
              >
                <Volume2 className="h-4 w-4" />
                Test Sound
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                className="text-danger hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : defaultSoundExists ? (
          <div className="space-y-3 rounded-lg bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">System Default Sound</p>
                <p className="text-xs text-muted">Using default notification sound</p>
              </div>
              <Music className="h-5 w-5 shrink-0 text-primary" />
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={handlePlayTest}
              className="w-full"
            >
              <Volume2 className="h-4 w-4" />
              Test Default Sound
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-border bg-slate-50 p-4">
            <p className="text-center text-sm text-muted">No custom sound or default sound</p>
            <p className="text-center text-xs text-muted">Upload a sound or place one in /public/sounds/notification.mp3</p>
          </div>
        )}

        <label className="block">
          <div className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50 hover:bg-primary/10">
            <input
              type="file"
              accept="audio/mp3,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/m4a,.mp3,.wav,.ogg,.aac,.m4a"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-2 text-center">
              <Upload className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">
                  {uploading ? 'Uploading...' : 'Click to upload sound'}
                </p>
                <p className="text-xs text-muted">MP3, WAV, OGG, AAC, M4A (max 5MB)</p>
              </div>
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}
