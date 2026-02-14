import { useState, useEffect, useRef } from 'react'

function VideoCall({ socket, user, call, onEndCall }) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [localStream, setLocalStream] = useState(null)

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

  // ICE servers: Xirsys TURN for production + env override
  const buildRtcConfig = () => {
    const turnUrl = import.meta.env.VITE_TURN_URL
    const turnUsername = import.meta.env.VITE_TURN_USERNAME
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL

    let iceServers
    if (turnUrl && turnUsername && turnCredential) {
      const urls = turnUrl.split(',').map(u => u.trim()).filter(Boolean)
      iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls, username: turnUsername, credential: turnCredential }
      ]
      log('Using TURN from env:', urls)
    } else {
      iceServers = [
        { urls: 'stun:bn-turn1.xirsys.com' },
        {
          urls: [
            'turn:bn-turn1.xirsys.com:3478?transport=udp',
            'turns:bn-turn1.xirsys.com:443?transport=tcp'
          ],
          username: '03xY94mDGoIApn_9iLVdwsispddRPUVOrG_NA515X8IG27gjkih7zVLgE8tDgu15AAAAAGmQ6VhsZWFmMDE=',
          credential: '5130a306-09ec-11f1-bfc8-0242ac140004'
        }
      ]
      log('Using built-in Xirsys TURN')
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
        log('Queuing ICE candidate (remoteDescription null)')
        pendingCandidatesRef.current.push(candidate)
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
      // 1. Capture microphone (always) and optionally camera
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video'
      }
      log('getUserMedia constraints:', JSON.stringify(constraints))

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const tracks = stream.getTracks()
      log('Local stream tracks:', tracks.map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled })))

      if (!tracks.some(t => t.kind === 'audio')) {
        console.error('[WebRTC] No audio track captured - microphone may be blocked')
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const rtcConfig = buildRtcConfig()
      const pc = new RTCPeerConnection(rtcConfig)
      peerConnectionRef.current = pc

      // 2. Add tracks BEFORE createOffer/createAnswer - one stream, all tracks
      tracks.forEach(track => {
        const sender = pc.addTrack(track, stream)
        log('addTrack:', track.kind, 'sender:', !!sender)
      })

      const senders = pc.getSenders()
      log('PC senders after addTrack:', senders.map(s => ({ kind: s.track?.kind, id: s.track?.id })))

      // 3. Play remote audio in <audio autoplay>; video in <video> for video calls
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0]
        const track = event.track
        const remoteTracks = remoteStream?.getTracks().map(t => t.kind) || []
        log('ontrack:', track.kind, 'streamId:', remoteStream?.id, 'remote tracks:', remoteTracks)

        if (!remoteStream) return
        remoteStreamRef.current = remoteStream

        if (callTypeRef.current === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream
        }

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream
          remoteAudioRef.current.autoplay = true
          remoteAudioRef.current.muted = false
          remoteAudioRef.current.volume = 1
          const p = remoteAudioRef.current.play()
          if (p?.then) {
            p.then(() => log('Remote audio playing'))
              .catch(e => console.warn('[WebRTC] Remote audio play failed:', e))
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
      console.error('[WebRTC] Error initializing call:', error)
      alert('Error accessing camera/microphone. Please check permissions.')
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-background-dark text-white antialiased font-display z-50">
      {/* Remote audio - always rendered for voice calls and as fallback for video */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
        aria-hidden
      />
      {/* Main Active Video Background */}
      <div className="fixed inset-0 z-0">
        {call.type === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-background-dark to-primary/10 flex items-center justify-center">
            <div className="text-center">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(call.fromUsername || call.from)}&background=33e67a&color=112117&size=200`}
                alt={call.fromUsername || call.from}
                className="w-48 h-48 rounded-full mx-auto mb-4 ring-4 ring-primary/30"
              />
              <h2 className="text-3xl font-bold text-white mb-2">{call.fromUsername || call.from}</h2>
              <p className="text-primary/70">{formatTime(callDuration)}</p>
            </div>
          </div>
        )}
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-background-dark/80 via-transparent to-background-dark/80 pointer-events-none"></div>
      </div>

      {/* Main UI Container */}
      <div className="relative z-10 flex flex-col h-screen w-full max-w-md mx-auto px-6 py-12 justify-between pointer-events-none">
        {/* Header Info */}
        <div className="flex flex-col items-center mt-4 pointer-events-auto">
          <div className="flex items-center space-x-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-sm font-medium tracking-wide text-primary uppercase">Encrypted Call</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">{call.fromUsername || call.from}</h1>
          <p className="text-white/80 font-medium">{formatTime(callDuration)}</p>
        </div>

        {/* Floating Picture-in-Picture (Local Camera) */}
        {call.type === 'video' && (
          <div className="absolute right-6 bottom-36 w-28 h-40 rounded-lg overflow-hidden border-2 border-primary/30 shadow-2xl pointer-events-auto ring-4 ring-black/20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2">
              <span className="material-icons text-sm bg-black/40 p-1 rounded-full text-white">flip_camera_ios</span>
            </div>
          </div>
        )}

        {/* Floating Control Bar */}
        <div className="w-full flex justify-center mb-6 pointer-events-auto">
          <div className="glass-panel flex items-center justify-between px-6 py-4 rounded-full w-full max-w-xs shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                isMuted ? 'bg-danger text-white' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <span className="material-icons">{isMuted ? 'mic_off' : 'mic'}</span>
            </button>

            {/* Video Toggle */}
            {call.type === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  isVideoOff ? 'bg-white/10 text-white' : 'bg-primary text-background-dark hover:opacity-90'
                }`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                <span className="material-icons">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
              </button>
            )}

            {/* Screen Share */}
            {call.type === 'video' && (
              <button
                onClick={toggleScreenShare}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  isScreenSharing ? 'bg-primary text-background-dark' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <span className="material-icons">screen_share</span>
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={() => {
                cleanup()
                onEndCall()
              }}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-danger hover:brightness-110 transition-all text-white shadow-lg shadow-danger/20"
              title="End call"
            >
              <span className="material-icons text-3xl">call_end</span>
            </button>
          </div>
        </div>
      </div>

      {/* UI Overlay Controls (Side) */}
      <div className="fixed right-6 top-1/3 flex flex-col space-y-4 z-20 pointer-events-auto">
        <button className="w-10 h-10 flex items-center justify-center rounded-full glass-panel text-white">
          <span className="material-icons text-lg">person_add</span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full glass-panel text-white">
          <span className="material-icons text-lg">settings</span>
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full glass-panel text-white">
          <span className="material-icons text-lg">chat_bubble</span>
        </button>
      </div>

      {/* Top Left Back Button */}
      <div className="fixed left-6 top-16 z-20 pointer-events-auto">
        <button
          onClick={() => {
            cleanup()
            onEndCall()
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full glass-panel text-white"
        >
          <span className="material-icons">keyboard_arrow_left</span>
        </button>
      </div>

      {/* Background Decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-primary/5 rounded-full blur-[100px]"></div>
      </div>
    </div>
  )
}

export default VideoCall
