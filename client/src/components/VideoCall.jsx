import { useState, useEffect, useRef } from 'react'

function VideoCall({ socket, user, call, onEndCall }) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [localStream, setLocalStream] = useState(null)
  const selectedSinkIdRef = useRef('')

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const screenStreamRef = useRef(null)
  const pendingOfferRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const callTypeRef = useRef(call?.type)
  callTypeRef.current = call?.type

  const DEBUG = import.meta.env.DEV || !!import.meta.env.VITE_WEBRTC_DEBUG

  const log = (...args) => { if (DEBUG) console.log('[WebRTC]', ...args) }

  // ICE servers: read TURN from Vercel env (VITE_TURN_*) for production cross-network calls
  const buildRtcConfig = () => {
    const turnUrl = import.meta.env.VITE_TURN_URL
    const turnUsername = import.meta.env.VITE_TURN_USERNAME
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL

    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]

    if (turnUrl && turnUsername && turnCredential) {
      const urls = turnUrl.split(',').map((u) => u.trim()).filter(Boolean)
      iceServers.push({ urls, username: turnUsername, credential: turnCredential })
      log('Using TURN from env')
    } else if (import.meta.env.PROD) {
      console.warn('[WebRTC] No TURN env: set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL in Vercel for mobile/cross-network calls')
    }

    return {
      iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  }

  useEffect(() => {
    let interval
    if (call) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [call])

  useEffect(() => {
    if (socket && call) {
      initializeCall()
    }

    return () => {
      cleanup()
    }
  }, [socket, call])

  const drainPendingCandidates = async (pc) => {
    const queue = pendingCandidatesRef.current
    if (queue.length === 0) return
    log('Draining', queue.length, 'queued ICE candidates')
    pendingCandidatesRef.current = []
    for (const c of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c))
        log('Added queued ICE candidate')
      } catch (err) {
        console.error('[WebRTC] Error adding queued ICE candidate:', err)
      }
    }
  }

  useEffect(() => {
    if (!socket) return

    const handleIceCandidate = async ({ candidate, from }) => {
      if (!peerConnectionRef.current || !candidate || from !== call?.from) return
      const pc = peerConnectionRef.current
      if (pc.remoteDescription === null) {
        pendingCandidatesRef.current.push(candidate)
        log('Buffered ICE candidate (remoteDescription not set yet)')
        return
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        log('Added ICE candidate from', from)
      } catch (error) {
        console.error('[WebRTC] Error adding ICE candidate:', error)
      }
    }

    const handleOffer = async ({ offer, from }) => {
      if (from !== call?.from) return
      log('Received offer from', from)
      if (!peerConnectionRef.current) {
        log('Offer queued (PC not ready)')
        pendingOfferRef.current = offer
        return
      }
      const pc = peerConnectionRef.current
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        await drainPendingCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        log('Sent answer to', call.from)
        socket.emit('answer', { to: call.from, answer })
      } catch (error) {
        console.error('[WebRTC] Error handling offer:', error)
      }
    }

    const handleAnswer = async ({ answer, from }) => {
      if (!peerConnectionRef.current || from !== call.from) return
      const pc = peerConnectionRef.current
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await drainPendingCandidates(pc)
        log('Set remote description (answer) from', from)
      } catch (error) {
        console.error('[WebRTC] Error handling answer:', error)
      }
    }

    socket.on('ice-candidate', handleIceCandidate)
    socket.on('offer', handleOffer)
    socket.on('answer', handleAnswer)

    return () => {
      socket.off('ice-candidate', handleIceCandidate)
      socket.off('offer', handleOffer)
      socket.off('answer', handleAnswer)
    }
  }, [socket, call])

  const initializeCall = async () => {
    const callType = callTypeRef.current
    const isCaller = call.isCaller !== false
    log('initializeCall', { callType, isCaller, remoteUserId: call.from })

    try {
      // 0. Check for microphone before requesting
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      console.log('[WebRTC] Available devices:', devices.map(d => ({ kind: d.kind, label: d.label || '(default)' })))

      if (audioInputs.length === 0) {
        console.error('[WebRTC] No microphone found')
        alert('No microphone detected. Please connect a microphone and try again.')
        return
      }

      // 1. Capture microphone with advanced audio constraints
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      }

      const constraints = {
        audio: audioConstraints,
        video: callType === 'video'
      }
      log('getUserMedia constraints:', JSON.stringify(constraints))

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        console.error('[WebRTC] getUserMedia failed:', err.name, err.message, err)
        if (err.name === 'NotFoundError') {
          alert('No microphone or camera found. Please connect a device and refresh.')
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert('Microphone permission denied. Please allow access and try again.')
        } else if (err.name === 'NotReadableError') {
          alert('Microphone is in use by another app. Please close other apps and try again.')
        } else if (err.name === 'OverconstrainedError') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: callType === 'video'
            })
          } catch (fallbackErr) {
            console.error('[WebRTC] Fallback getUserMedia failed:', fallbackErr)
            alert(`Could not access microphone: ${fallbackErr.message}`)
            return
          }
        } else {
          alert(`Could not access microphone: ${err.message}`)
          return
        }
      }

      const tracks = stream.getTracks()
      console.log('[WebRTC] Local tracks:', stream.getTracks())

      const audioTrack = tracks.find(t => t.kind === 'audio')
      if (!audioTrack) {
        console.error('[WebRTC] No audio track in stream')
        stream.getTracks().forEach(t => t.stop())
        alert('Failed to capture microphone audio.')
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const rtcConfig = buildRtcConfig()
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = pc

      // 2. Add tracks with addTrack() - audio first so it's in SDP, then video
      const audioTracks = stream.getAudioTracks()
      const videoTracks = stream.getVideoTracks()
      audioTracks.forEach(track => {
        pc.addTrack(track, stream)
        log('addTrack (audio):', track.id)
      })
      videoTracks.forEach(track => {
        pc.addTrack(track, stream)
        log('addTrack (video):', track.id)
      })

      const senders = pc.getSenders()
      log('PC senders after addTrack:', senders.map(s => ({ kind: s.track?.kind, id: s.track?.id })))

      // 3. ontrack: attach remote stream to <audio autoPlay playsInline> so remote audio is heard
      pc.ontrack = (event) => {
        const track = event.track
        const remoteStream = event.streams?.[0] || new MediaStream([track])
        remoteStreamRef.current = remoteStream
        console.log('[WebRTC] Remote track received:', track.kind)

        if (callTypeRef.current === 'video' && remoteVideoRef.current && track.kind === 'video') {
          remoteVideoRef.current.srcObject = remoteStream
          remoteVideoRef.current.muted = true
          remoteVideoRef.current.play().catch(() => {})
        }

        const el = remoteAudioRef.current
        if (el) {
          el.srcObject = remoteStream
          el.muted = false
          el.volume = 1
          el.play().then(() => log('Remote audio playing')).catch(e => console.warn('[WebRTC] Remote audio play:', e))
          if (typeof el.setSinkId === 'function') {
            navigator.mediaDevices.enumerateDevices().then(devices => {
              const out = devices.find(d => d.kind === 'audiooutput')
              if (out?.deviceId) el.setSinkId(out.deviceId).catch(() => {})
            }).catch(() => {})
          }
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const c = event.candidate
          log('ICE candidate:', c.type, c.candidate?.substring(0, 80) + '...')
          if (socket) {
            socket.emit('ice-candidate', { to: call.from, candidate: event.candidate })
          }
        } else {
          log('ICE gathering complete')
        }
      }

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState
        log('ICE connection state:', state)
        if (state === 'failed' || state === 'disconnected') {
          console.warn('[WebRTC] ICE state:', state, '- TURN may be needed or credentials expired')
        }
      }

      pc.onconnectionstatechange = () => {
        log('Connection state:', pc.connectionState)
      }

      pc.onsignalingstatechange = () => {
        log('Signaling state:', pc.signalingState)
      }

      // Caller creates offer; callee waits for offer in handleOffer
      if (isCaller) {
        try {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          log('Offer created, senders:', pc.getSenders().map(s => s.track?.kind))
          socket.emit('offer', { to: call.from, offer })
        } catch (error) {
          console.error('[WebRTC] Error creating offer:', error)
        }
      } else {
        const pending = pendingOfferRef.current
        if (pending) {
          pendingOfferRef.current = null
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(pending))
            await drainPendingCandidates(pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            log('Answer created, senders:', pc.getSenders().map(s => s.track?.kind))
            socket.emit('answer', { to: call.from, answer })
          } catch (error) {
            console.error('[WebRTC] Error handling pending offer:', error)
          }
        }
      }
    } catch (error) {
      console.error('[WebRTC] Error initializing call:', error.name, error.message, error)
      alert(error.message || 'Error starting call. Please try again.')
    }
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = !isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      videoTracks.forEach(track => {
        track.enabled = !isVideoOff
      })
      setIsVideoOff(!isVideoOff)
    }
  }

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenStreamRef.current = screenStream

        const videoTrack = screenStream.getVideoTracks()[0]
        const sender = peerConnectionRef.current?.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        )

        if (sender && peerConnectionRef.current) {
          await sender.replaceTrack(videoTrack)
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }

        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare()
        }

        setIsScreenSharing(true)
      } else {
        stopScreenShare()
      }
    } catch (error) {
      console.error('Error sharing screen:', error)
    }
  }

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
    }

    if (localStreamRef.current && peerConnectionRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      const sender = peerConnectionRef.current.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      )

      if (sender) {
        await sender.replaceTrack(videoTrack)
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
    }

    setIsScreenSharing(false)
  }

  const cleanup = () => {
    setLocalStream(null)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    pendingOfferRef.current = null
    pendingCandidatesRef.current = []
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }
  }

  const setSpeaker = async (deviceId) => {
    const el = remoteAudioRef.current
    if (el && typeof el.setSinkId === 'function' && deviceId) {
      try {
        await el.setSinkId(deviceId)
        selectedSinkIdRef.current = deviceId
        log('setSinkId:', deviceId)
      } catch (e) {
        console.warn('[WebRTC] setSinkId failed:', e)
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-[#0a1f17] text-white antialiased z-50 flex flex-col min-h-screen min-h-[100dvh]">
      {/* Remote audio: autoPlay + playsInline so remote audio is heard; ref used in peerConnection.ontrack */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
        aria-hidden
      />

      {/* Full-screen background: video or gradient */}
      <div className="absolute inset-0 z-0">
        {call.type === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-[#0d281e] to-[#062018]" />
        )}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      </div>

      {/* Top bar: back + timer - safe area aware */}
      <header
        className="relative z-10 flex items-center justify-between px-4 pt-2 pb-2 sm:px-5 sm:pt-3"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
        <button
          type="button"
          onClick={() => { cleanup(); onEndCall() }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white touch-manipulation"
          aria-label="Back"
        >
          <span className="material-icons text-xl">arrow_back</span>
        </button>
        <p className="text-white/90 font-medium tabular-nums text-base sm:text-lg">
          {formatTime(callDuration)}
        </p>
        <div className="w-10" />
      </header>

      {/* Center: avatar + name (voice) or local PiP (video) */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 min-h-0"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
        {call.type === 'video' ? (
          <div
            className="absolute right-3 bottom-24 w-24 h-32 sm:right-4 sm:bottom-28 sm:w-28 sm:h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black/40"
            style={{ right: 'max(0.75rem, env(safe-area-inset-right))' }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <>
            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-[#25D366] flex items-center justify-center shadow-[0_0_40px_rgba(37,211,102,0.3)] ring-4 ring-white/10 flex-shrink-0">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(call.fromUsername || call.from)}&background=0d281e&color=fff&size=128`}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <p className="mt-4 text-white font-semibold text-lg sm:text-xl text-center max-w-[85vw] truncate">
              {call.fromUsername || call.from}
            </p>
            <p className="mt-1 text-[#25D366] text-sm font-medium">Encrypted call</p>
          </>
        )}
      </main>

      {/* Bottom: Mic | End | Speaker - WhatsApp-like, safe-area */}
      <footer
        className="relative z-10 flex items-center justify-center gap-4 sm:gap-6 py-4 px-4 sm:py-5 sm:px-6"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))'
        }}
      >
        <button
          type="button"
          onClick={toggleMute}
          className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full touch-manipulation transition-transform active:scale-95 ${
            isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <span className="material-icons text-2xl sm:text-3xl">{isMuted ? 'mic_off' : 'mic'}</span>
        </button>

        <button
          type="button"
          onClick={() => { cleanup(); onEndCall() }}
          className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-red-500 text-white touch-manipulation transition-transform active:scale-95 shadow-lg shadow-red-500/30"
          aria-label="End call"
        >
          <span className="material-icons text-3xl sm:text-4xl">call_end</span>
        </button>

        <button
          type="button"
          onClick={() => {}}
          className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-white/20 text-white touch-manipulation transition-transform active:scale-95"
          aria-label="Speaker"
        >
          <span className="material-icons text-2xl sm:text-3xl">volume_up</span>
        </button>
      </footer>

      {/* Video-only: extra controls row (camera, screen share) */}
      {call.type === 'video' && (
        <div className="relative z-10 flex items-center justify-center gap-3 pb-2 px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button
            type="button"
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center touch-manipulation ${
              isVideoOff ? 'bg-white/20 text-white' : 'bg-[#25D366] text-white'
            }`}
            aria-label={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            <span className="material-icons">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
          </button>
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center touch-manipulation ${
              isScreenSharing ? 'bg-[#25D366] text-white' : 'bg-white/20 text-white'
            }`}
            aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <span className="material-icons">screen_share</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default VideoCall
