import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, ArrowLeft, Users, Settings, MessageSquare } from 'lucide-react'

const VOLUME_THRESHOLD = 18
const SMOOTHING = 0.75

/**
 * EncryptedCallScreen - Premium WhatsApp-style encrypted call UI.
 * Optional mic speaking indicator when localStream is provided.
 *
 * @param {string} callId - Call/user ID
 * @param {number} callDurationSeconds - Elapsed seconds
 * @param {boolean} isMuted - Mic muted state
 * @param {MediaStream | null} localStream - Optional; used for speaking detection
 * @param {function} onMuteToggle - () => void
 * @param {function} onEndCall - () => void
 * @param {function} onBack - () => void
 * @param {function} onParticipants - () => void
 * @param {function} onSettings - () => void
 * @param {function} onChat - () => void
 */
function EncryptedCallScreen({
  callId = '698f8639ee50aab41940ebd5',
  callDurationSeconds = 0,
  isMuted = false,
  localStream = null,
  onMuteToggle = () => {},
  onEndCall = () => {},
  onBack = () => {},
  onParticipants = () => {},
  onSettings = () => {},
  onChat = () => {},
}) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const analyserRef = useRef(null)
  const contextRef = useRef(null)
  const rafRef = useRef(null)
  const streamRef = useRef(null)

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const initials = callId ? callId.slice(0, 2) : '00'

  // Mic speaking detection via Web Audio API
  useEffect(() => {
    if (!localStream) {
      setIsSpeaking(false)
      return
    }
    const tracks = localStream.getAudioTracks()
    if (!tracks.length || !tracks[0].enabled) {
      setIsSpeaking(false)
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
      analyser.smoothingTimeConstant = SMOOTHING
      analyser.minDecibels = -55
      analyser.maxDecibels = -10
      source.connect(analyser)
      contextRef.current = context
      analyserRef.current = analyser
      streamRef.current = localStream
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const tick = () => {
        if (!analyserRef.current || !streamRef.current) return
        const t = streamRef.current.getAudioTracks()
        if (!t.length || !t[0].enabled) {
          setIsSpeaking(false)
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        analyserRef.current.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength
        setIsSpeaking(avg > VOLUME_THRESHOLD)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      setIsSpeaking(false)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try {
        source?.disconnect()
        context?.close()
      } catch (_) {}
      contextRef.current = null
      analyserRef.current = null
      streamRef.current = null
    }
  }, [localStream])

  const showSpeaking = !isMuted && isSpeaking

  const btnBase =
    'rounded-full flex items-center justify-center transition-all duration-200 ease-out select-none touch-manipulation'
  const btnHoverPress = 'hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
  const fabBase =
    'rounded-full flex items-center justify-center transition-all duration-200 ease-out select-none touch-manipulation hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0a1f17] text-white overflow-hidden">
      {/* Dark green gradient + vignette */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0d281e] via-[#0a1f17] to-[#062018]"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow:
            'inset 0 0 120px 40px rgba(0,0,0,0.4), inset 0 0 60px 20px rgba(0,20,10,0.2)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* Top-left: Back button */}
        <div className="absolute top-5 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8 z-20">
          <button
            type="button"
            onClick={onBack}
            className={`${fabBase} w-12 h-12 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/15 active:bg-white/10`}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-5 md:w-6 md:h-6" strokeWidth={2.5} />
          </button>
        </div>

        {/* Top center: Header */}
        <header className="flex flex-col items-center pt-20 sm:pt-24 md:pt-28 pb-4 sm:pb-6 px-4">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"
              aria-hidden
            />
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-[#25D366] uppercase">
              Encrypted Call
            </span>
          </div>
          <p className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight break-all text-center max-w-[90vw]">
            {callId}
          </p>
          <p className="text-white/80 font-medium text-lg sm:text-xl md:text-2xl mt-1 tabular-nums">
            {formatTimer(callDurationSeconds)}
          </p>
        </header>

        {/* Center: Profile circle */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-2 sm:-mt-4">
          <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_0_40px_rgba(37,211,102,0.35)] ring-4 ring-white/10">
            <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#0a1f17] tabular-nums">
              {initials}
            </span>
          </div>
        </main>

        {/* Speaking indicator pill (when audio detected) */}
        {localStream && (
          <div className="flex justify-center px-4 pb-1">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                showSpeaking
                  ? 'bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/40'
                  : 'bg-white/5 text-white/60 border border-white/10'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  showSpeaking ? 'bg-[#25D366] animate-pulse' : 'bg-white/50'
                }`}
              />
              {showSpeaking ? 'Speaking…' : 'Silent'}
            </div>
          </div>
        )}

        {/* Bottom: Floating pill control bar - single bar, no duplicate shadow */}
        <div className="flex justify-center px-4 pb-6 sm:pb-8 md:pb-10 pt-3 sm:pt-4">
          <div
            className="flex items-center justify-between gap-3 sm:gap-4 px-5 sm:px-6 py-3.5 sm:py-4 rounded-full max-w-sm w-full backdrop-blur-md transition-all duration-300 border border-[#25D366]/30"
            style={{
              background: 'linear-gradient(180deg, rgba(40,45,42,0.9) 0%, rgba(28,35,32,0.95) 100%)',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 -1px 0 0 rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.35)',
            }}
          >
            {/* Left: Microphone mute toggle - slightly lighter grey circle */}
            <button
              type="button"
              onClick={onMuteToggle}
              className={`${btnBase} ${btnHoverPress} w-12 h-12 sm:w-14 sm:h-14 rounded-full ${
                isMuted
                  ? 'bg-red-500/95 text-white shadow-lg shadow-red-500/30'
                  : 'bg-white/20 text-white hover:bg-white/30 shadow-sm'
              }`}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <MicOff className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              ) : (
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              )}
            </button>

            {/* Center: Voice indicator - pronounced glow when speaking */}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                className={`${btnBase} w-12 h-12 sm:w-14 sm:h-14 rounded-full text-white ${btnHoverPress} transition-all duration-300 ${
                  showSpeaking
                    ? 'bg-white/25 shadow-[0_0_20px_rgba(37,211,102,0.35)] ring-2 ring-[#25D366]/50'
                    : 'bg-white/20 hover:bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                }`}
                aria-label="Voice indicator"
              >
                <Mic className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </button>
              {showSpeaking && (
                <span
                  className="absolute inset-0 rounded-full border-2 border-[#25D366]/50 animate-ping opacity-30"
                  aria-hidden
                />
              )}
            </div>

            {/* Right: End call - red with soft halo */}
            <button
              type="button"
              onClick={onEndCall}
              className={`${btnBase} ${btnHoverPress} w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500 text-white hover:bg-red-600`}
              style={{
                boxShadow: '0 4px 20px rgba(239,68,68,0.45), 0 0 0 0 rgba(239,68,68,0.2)',
              }}
              aria-label="End call"
            >
              <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Right-side: Floating action buttons */}
      <div className="absolute right-4 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onParticipants}
          className={`${fabBase} w-12 h-12 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/15`}
          aria-label="Participants"
        >
          <Users className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onSettings}
          className={`${fabBase} w-12 h-12 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/15`}
          aria-label="Settings"
        >
          <Settings className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onChat}
          className={`${fabBase} w-12 h-12 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/15`}
          aria-label="Chat"
        >
          <MessageSquare className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

export default EncryptedCallScreen
