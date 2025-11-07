# Transcript Service Setup

The transcript service uses **Web Speech API** - a free, browser-native speech recognition service.

## Web Speech API (Free, No Setup Required)

- **Status**: ✅ Already working
- **Browser Support**: Chrome, Edge (Chromium browsers only)
- **Cost**: Completely free
- **Accuracy**: Good
- **Limitations**: 
  - Only works in Chrome/Edge browsers
  - Captures local audio only (your microphone)
  - Requires internet connection for processing

## How It Works

1. **Automatic Start**: The transcript service automatically starts when the interview begins
2. **Real-time Transcription**: Speech is transcribed in real-time as you speak
3. **Auto-save**: Transcripts are saved to Firestore every 5 seconds
4. **Append Mode**: New transcript entries are appended to existing ones (prevents overwriting)
5. **Display**: Transcripts are shown in interview details after completion

## Usage

The transcript service automatically:
- Starts when the interview begins
- Transcribes speech in real-time
- Saves to Firestore every 5 seconds (appends to existing transcript)
- Shows transcript in interview details after completion

## Browser Requirements

- **Chrome** (recommended) - Full support
- **Edge** (Chromium) - Full support
- **Firefox** - Not supported (Web Speech API not available)
- **Safari** - Not supported (Web Speech API not available)

## Troubleshooting

If transcription is not working:

1. **Check Browser**: Make sure you're using Chrome or Edge
2. **Check Microphone**: Ensure microphone permissions are granted
3. **Check Console**: Open browser console (F12) to see any errors
4. **Check Internet**: Web Speech API requires internet connection

## Notes

- Transcripts are saved incrementally (every 5 seconds) to prevent data loss
- If the service is restarted (e.g., microphone switch), it loads existing transcript and appends new entries
- Duplicate entries are automatically removed

