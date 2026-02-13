import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff } from 'lucide-react'

const VOLUME_THRESHOLD = 15
const SMOOTHING_FACTOR = 0.8

/**
 * MicIndicator - Professional microphone status UI for calls.
 * Uses Web Audio API to detect real-time voice activity.
 *
 * @param {MediaStream | null} localStream - User's local media stream (from getUserMedia)
 * @param {boolean} isMuted - Whether the user has muted their microphone
 * @param {string} className - Optional additional Tailwind classes
 */
function MicIndicator({ localStream, isMuted = false, className = '' }) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [hasAudioTrack, setHasAudioTrack] = useState(false)
  const [volumeLevel, setVolumeLevel] = useState(0)

  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!localStream) {
      setHasAudioTrack(false)
      setIsSpeaking(false)
      setVolumeLevel(0)
      return
    }

    const audioTracks = localStream.getAudioTracks()
    const hasAudio = audioTracks.length > 0 && audioTracks[0].enabled
    setHasAudioTrack(hasAudio)

    if (!hasAudio) {
      setIsSpeaking(false)
      setVolumeLevel(0)
      return
    }

    let context
    let analyser
    let source

    try {
      context = new (window.AudioContext || window.webkitAudioContext)()
      analyser = context.createAnalyser()
      source = context.createMediaStreamSource(localStream)

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = SMOOTHING_FACTOR
      analyser.minDecibels = -60
      analyser.maxDecibels = -10
      source.connect(analyser)

      audioContextRef.current = context
      analyserRef.current = analyser
      streamRef.current = localStream

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const checkVolume = () => {
        if (!analyserRef.current || !streamRef.current) return

        const audioTracks = streamRef.current.getAudioTracks()
        if (audioTracks.length === 0 || !audioTracks[0].enabled) {
          setIsSpeaking(false)
          setVolumeLevel(0)
          animationFrameRef.current = requestAnimationFrame(checkVolume)
          return
        }

        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength
        setVolumeLevel(average)
        setIsSpeaking(average > VOLUME_THRESHOLD)
        animationFrameRef.current = requestAnimationFrame(checkVolume)
      }

      checkVolume()
    } catch (err) {
      console.error('MicIndicator: Web Audio API error', err)
      setHasAudioTrack(!!localStream.getAudioTracks().length)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      try {
        source?.disconnect()
        context?.close()
      } catch (_) {}
      audioContextRef.current = null
      analyserRef.current = null
      streamRef.current = null
    }
  }, [localStream])

  // When muted, override speaking state
  const effectivelyMuted = isMuted || !hasAudioTrack
  const showSpeaking = !effectivelyMuted && isSpeaking

  const statusText = effectivelyMuted
    ? 'Microphone muted'
    : showSpeaking
      ? 'Speaking…'
      : 'Silent'

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-2xl
        bg-black/40 backdrop-blur-md border border-white/10
        shadow-[0_4px_24px_rgba(0,0,0,0.25)]
        transition-all duration-300
        ${className}
      `}
    >
      <div
        className={`
          flex items-center justify-center w-10 h-10 rounded-full shrink-0
          transition-all duration-300
          ${effectivelyMuted
            ? 'bg-red-500/90 text-white'
            : showSpeaking
              ? 'bg-primary text-background-dark shadow-lg shadow-primary/40'
              : 'bg-white/20 text-white'
          }
          ${showSpeaking ? 'animate-pulse-scale' : ''}
        `}
      >
        {effectivelyMuted ? (
          <MicOff className="w-5 h-5" strokeWidth={2.5} />
        ) : (
          <Mic className="w-5 h-5" strokeWidth={2.5} />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {statusText}
        </p>
        {!effectivelyMuted && (
          <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${Math.min(100, (volumeLevel / 128) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default MicIndicator
