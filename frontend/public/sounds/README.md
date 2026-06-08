# Notification Sounds

Place your notification sound file here as `notification.mp3` (or any supported format: WAV, OGG, AAC, M4A).

## Setup Instructions

1. **Add Your Default Sound**:
   - Place your audio file in this folder
   - Name it `notification.mp3` (or update the path in `frontend/src/utils/customNotificationSound.ts`)
   - Supported formats: MP3, WAV, OGG, AAC, M4A

2. **System Priority**:
   - **Custom Sound** (User uploaded via Settings): Highest priority
   - **Default Sound** (this folder): Used if no custom sound uploaded
   - **Generated Chime**: Fallback if both above fail

3. **Example File**:
   ```
   frontend/public/sounds/notification.mp3
   ```

4. **Update Config** (if using different filename):
   Edit `frontend/src/utils/customNotificationSound.ts`:
   ```typescript
   const DEFAULT_SOUND_PATH = '/sounds/your-sound-file.mp3'
   ```

## File Requirements

- **Format**: MP3, WAV, OGG, AAC, or M4A
- **Duration**: 0.5s - 3s recommended
- **Size**: Keep under 100KB for fast loading
- **Quality**: 128kbps or higher for audio quality

## Testing

1. Add your sound file here
2. Restart the frontend (if running in dev mode)
3. Go to Settings → Notification Sound
4. Click "Test Default Sound" to verify it plays
5. Or use browser console: `window.playCustomSound()`
