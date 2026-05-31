import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { io } from 'socket.io-client'
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Copy, 
  MessageSquare, 
  Send, 
  Monitor, 
  MonitorOff,
  User,
  Sparkles,
  Check,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

// Single Video Card Component for Responsive Grid
const VideoCard = ({ stream, screenStream, isScreenSharing, isSignTranslationEnabled, isLocal, userObj, isVideoEnabled, isAudioEnabled, rawStream, signTranslationText, activeVideoMid }) => {
  const videoRef = useRef(null)

  // Physically strip zombie tracks from the stream to ensure HTML5 video seamlessly plays the active track
  const [activeStream, setActiveStream] = useState(null)

  // Derive a clean MediaStream containing only the active tracks.
  // This avoids mutating the raw WebRTC stream in-place, which often breaks <video> playback pipelines.
  useEffect(() => {
    if (!stream) {
      setActiveStream(null)
      return
    }

    if (activeVideoMid && !isLocal) {
      const activeTrack = stream.getVideoTracks().find(t => t._mid === activeVideoMid)
      if (activeTrack) {
        // Create a fresh stream with the correct audio and active video track to force the browser to play it
        setActiveStream(new MediaStream([...stream.getAudioTracks(), activeTrack]))
      } else {
        setActiveStream(stream)
      }
    } else {
      setActiveStream(stream)
    }
  }, [stream, activeVideoMid, isLocal])

  useEffect(() => {
    if (videoRef.current) {
      let srcChanged = false;
      if (isScreenSharing && screenStream) {
        if (videoRef.current.srcObject !== screenStream) { videoRef.current.srcObject = screenStream; srcChanged = true; }
      } else if (isLocal && isSignTranslationEnabled && rawStream) {
        if (videoRef.current.srcObject !== rawStream) { videoRef.current.srcObject = rawStream; srcChanged = true; }
      } else if (activeStream) {
        if (videoRef.current.srcObject !== activeStream) { videoRef.current.srcObject = activeStream; srcChanged = true; }
      }
      
      if (srcChanged) {
        videoRef.current.play().catch(e => console.log('Video play error:', e))
      }
    }
  }, [activeStream, screenStream, isScreenSharing, isLocal, rawStream, isSignTranslationEnabled])

  // Only consider video enabled for UI purposes if screen sharing is active OR normal video is enabled
  const showVideo = (isVideoEnabled || isScreenSharing) && (stream || rawStream || screenStream)

  return (
    <div className='relative w-full aspect-video bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center min-h-[180px]'>
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted={isLocal} 
        className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${showVideo ? 'block' : 'hidden'}`}
      />
      {!showVideo && (
        <div className='flex flex-col items-center text-center p-4 text-slate-400 z-10 absolute inset-0 justify-center bg-black/20 backdrop-blur-md'>
          <div className='w-16 h-16 rounded-full bg-white/5 border border-white/10 flex justify-center items-center mb-3 overflow-hidden shadow-sm'>
            {userObj?.imageUrl ? (
              <img src={userObj.imageUrl} alt={userObj.fullName} className='w-full h-full object-cover' />
            ) : (
              <User className='w-8 h-8 text-slate-500 opacity-50' />
            )}
          </div>
          <h4 className='text-white font-bold text-sm mb-0.5 drop-shadow-sm'>
            {isLocal ? 'You' : userObj?.fullName || 'Peer'}
          </h4>
          <p className='text-[10px] text-slate-500 font-medium'>Camera is disabled</p>
        </div>
      )}
      
      {signTranslationText && showVideo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 border border-emerald-500/30 text-emerald-400 font-bold text-3xl px-6 py-3 rounded-xl pointer-events-none z-20 backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          {signTranslationText}
        </div>
      )}

      {/* Name Overlay & Audio status */}
      <div className='absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-lg text-white text-xs shadow-sm border border-white/10'>
        {userObj?.imageUrl ? (
          <img src={userObj.imageUrl} alt={userObj.fullName} className='w-4 h-4 rounded-full object-cover border border-white/20' />
        ) : (
          <User className='w-3 h-3 text-slate-400' />
        )}
        <span className='font-semibold drop-shadow-sm'>{isLocal ? 'You' : userObj?.fullName || 'Peer'}</span>
        {!isAudioEnabled && (
          <MicOff className="w-3.5 h-3.5 text-red-400 ml-1" title="Muted" />
        )}
      </div>
    </div>
  )
}

const SOCKET_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:4000'

const peerConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ]
    }
  ]
}

const extractFeatures = (results) => {
  // Sort hands left to right based on minimum x coordinate
  const sortedHands = [...results.multiHandLandmarks].sort((a, b) => {
    const minA = Math.min(...a.map(lm => lm.x));
    const minB = Math.min(...b.map(lm => lm.x));
    return minA - minB;
  }).slice(0, 2);

  const rawX = [];
  const rawY = [];

  for (const hand of sortedHands) {
    for (const lm of hand) {
      rawX.push(lm.x);
      rawY.push(lm.y);
    }
  }

  // Pad if only one hand is detected
  if (sortedHands.length === 1) {
    for (let i = 0; i < 21; i++) {
      rawX.push(0.0);
      rawY.push(0.0);
    }
  }

  // Normalize Hand 1 relative to its wrist (index 0)
  const base1X = rawX[0];
  const base1Y = rawY[0];
  for (let i = 0; i < 21; i++) {
    rawX[i] -= base1X;
    rawY[i] -= base1Y;
  }

  // Normalize Hand 2 relative to its wrist (index 21)
  if (sortedHands.length > 1) {
    const base2X = rawX[21];
    const base2Y = rawY[21];
    for (let i = 21; i < 42; i++) {
      rawX[i] -= base2X;
      rawY[i] -= base2Y;
    }
  }

  // Interleave normalized x and y coordinates
  const processedFeatures = [];
  for (let i = 0; i < 42; i++) {
    processedFeatures.push(rawX[i]);
    processedFeatures.push(rawY[i]);
  }

  return processedFeatures;
};

const VideoCall = () => {
  const { user } = useUser()
  const isTeacher = user?.publicMetadata?.role === 'teacher';
  const [searchParams, setSearchParams] = useSearchParams()
  const urlRoomId = searchParams.get('room') || ''

  // UI State
  const [roomId, setRoomId] = useState(urlRoomId)
  const [inCall, setInCall] = useState(false)
  const [callStatus, setCallStatus] = useState('idle') // idle, lobby, connecting, connected, full
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [enableSignTranslation, setEnableSignTranslation] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [currentSignTranslation, setCurrentSignTranslation] = useState("")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Chat State
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  // Media Streams State
  const [localStream, setLocalStream] = useState(null)
  const [peers, setPeers] = useState([]) // Array of: { socketId, user, stream, videoEnabled, audioEnabled, isScreenSharing }

  // Refs for WebRTC & Socket
  const socketRef = useRef(null)
  const peerConnectionsRef = useRef(new Map())
  const peerRolesRef = useRef(new Map()) // socketId -> isInitiator // socketId -> RTCPeerConnection
  const iceCandidatesQueueRef = useRef(new Map()) // socketId -> Array of RTCIceCandidate
  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const chatEndRef = useRef(null)

  // Sign Language Pipeline Refs
  const rawCameraStreamRef = useRef(null)
  const rawVideoRef = useRef(null)
  const translationCanvasRef = useRef(null)
  const mlSocketRef = useRef(null)
  const drawLoopWorkerRef = useRef(null)
  const latestLandmarksRef = useRef(null)
  const latestLetterRef = useRef("")
  const isProcessingRef = useRef(false)
  const lastFrameSentTimeRef = useRef(0)
  const handsInstanceRef = useRef(null)
  const activeRoomIdRef = useRef(roomId)

  useEffect(() => {
    activeRoomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    return () => {
      // Cleanup sign language resources on component unmount
      if (handsInstanceRef.current) {
        console.log("Sign language pipeline: Closing MediaPipe Hands instance on unmount")
        try {
          handsInstanceRef.current.close()
        } catch (e) {
          console.error("Error closing hands instance on unmount:", e)
        }
        handsInstanceRef.current = null
      }
    }
  }, [])

  const addIceCandidateToPeer = async (socketId, pc, candidate) => {
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error(`Error adding received ICE candidate for ${socketId}:`, error)
      }
    } else {
      if (!iceCandidatesQueueRef.current.has(socketId)) {
        iceCandidatesQueueRef.current.set(socketId, [])
      }
      iceCandidatesQueueRef.current.get(socketId).push(candidate)
      console.log(`Queued ICE candidate for ${socketId}. Queue size: ${iceCandidatesQueueRef.current.get(socketId).length}`)
    }
  }

  const processQueuedIceCandidates = async (socketId, pc) => {
    if (!pc) return
    const queue = iceCandidatesQueueRef.current.get(socketId)
    if (queue && queue.length > 0) {
      console.log(`Processing ${queue.length} queued ICE candidates for ${socketId}`)
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (error) {
          console.error(`Error adding queued ICE candidate for ${socketId}:`, error)
        }
      }
      iceCandidatesQueueRef.current.set(socketId, [])
    }
  }


  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatOpen])

  // Clear unread count when chat is opened
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0)
    }
  }, [isChatOpen])

  const cleanupSignTranslation = () => {
    if (mlSocketRef.current) {
      mlSocketRef.current.close()
      mlSocketRef.current = null
    }
    if (drawLoopWorkerRef.current) {
      drawLoopWorkerRef.current.postMessage('stop')
      drawLoopWorkerRef.current.terminate()
      drawLoopWorkerRef.current = null
    }
    if (rawCameraStreamRef.current) {
      rawCameraStreamRef.current.getTracks().forEach(t => t.stop())
      rawCameraStreamRef.current = null
    }
    if (rawVideoRef.current) {
      rawVideoRef.current.srcObject = null
    }
    if (handsInstanceRef.current) {
      console.log("Sign language pipeline: Closing MediaPipe Hands instance on cleanup")
      try {
        handsInstanceRef.current.close()
      } catch (e) {
        console.error("Error closing hands instance:", e)
      }
      handsInstanceRef.current = null;
    }
    latestLandmarksRef.current = null
    latestLetterRef.current = ""
    setCurrentSignTranslation("")
    isProcessingRef.current = false
  }

  const setupSignTranslationPipeline = (videoTrack) => {
    cleanupSignTranslation()
    
    rawCameraStreamRef.current = new MediaStream([videoTrack])
    if (rawVideoRef.current) {
      rawVideoRef.current.srcObject = rawCameraStreamRef.current
      rawVideoRef.current.play().catch(e => console.log('play error', e))
    }

    const wsHost = window.location.hostname
    const defaultWsUrl = wsHost === 'localhost' || wsHost === '127.0.0.1' 
      ? `ws://${wsHost}:8000/ws/detect` 
      : `wss://${wsHost}/ws/detect`
    const wsUrl = import.meta.env.VITE_SIGN_LANGUAGE_WS_URL || defaultWsUrl
    console.log("Sign language pipeline: Connecting to WebSocket at", wsUrl)
    mlSocketRef.current = new WebSocket(wsUrl)

    mlSocketRef.current.onopen = () => {
      console.log("Sign language pipeline: WebSocket connection established successfully to", wsUrl)
      isProcessingRef.current = false
    }

    mlSocketRef.current.onerror = (err) => {
      console.error("Sign language pipeline: WebSocket error occurred:", err)
      isProcessingRef.current = false
    }

    mlSocketRef.current.onclose = (event) => {
      console.log(`Sign language pipeline: WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`)
      isProcessingRef.current = false
    }

    mlSocketRef.current.onmessage = (event) => {
      isProcessingRef.current = false
      const data = JSON.parse(event.data)
      
      if (data.error) {
        console.warn("Sign language pipeline: Server processing error:", data.error)
      }
      
      const newLetter = data.letter || ""
      if (latestLetterRef.current !== newLetter) {
        latestLetterRef.current = newLetter
        setCurrentSignTranslation(newLetter)
        
        // Broadcast via Socket.io for maximum reliability across networks
        if (socketRef.current && activeRoomIdRef.current) {
          socketRef.current.emit("sign-translation", { text: newLetter, roomId: activeRoomIdRef.current })
        }
      }
    }

    // Lazy-initialize MediaPipe Hands client-side
    if (!handsInstanceRef.current && window.Hands) {
      console.log("Sign language pipeline: Initializing MediaPipe Hands in browser...")
      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });
      
      hands.onResults((results) => {
        if (results.multiHandLandmarks) {
          const flatLandmarks = [];
          for (const hand of results.multiHandLandmarks) {
            for (const lm of hand) {
              flatLandmarks.push({ x: lm.x, y: lm.y });
            }
          }
          latestLandmarksRef.current = flatLandmarks;
        } else {
          latestLandmarksRef.current = null;
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const features = extractFeatures(results);
          if (mlSocketRef.current?.readyState === WebSocket.OPEN && !isProcessingRef.current) {
            isProcessingRef.current = true;
            lastFrameSentTimeRef.current = Date.now();
            mlSocketRef.current.send(JSON.stringify({ features }));
          }
        } else {
          // No hands detected in the frame
          if (latestLetterRef.current !== "") {
            latestLetterRef.current = "";
            setCurrentSignTranslation("");
            // Broadcast empty translation via Socket.io
            if (socketRef.current && activeRoomIdRef.current) {
              socketRef.current.emit("sign-translation", { text: "", roomId: activeRoomIdRef.current })
            }
          }
        }
      });
      handsInstanceRef.current = hands;
    }
    
    const workerCode = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          intervalId = setInterval(() => self.postMessage('tick'), 45);
        } else if (e.data === 'stop') {
          clearInterval(intervalId);
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    drawLoopWorkerRef.current = new Worker(URL.createObjectURL(blob));
    
    lastFrameSentTimeRef.current = Date.now()
    
    drawLoopWorkerRef.current.onmessage = async () => {
      const now = Date.now()
      // Safety reset: if we've been processing for > 1500ms, assume frame/response was lost and reset lock
      if (isProcessingRef.current && (now - lastFrameSentTimeRef.current > 1500)) {
        console.warn("Sign language pipeline: Frame processing timeout. Resetting processing flag.")
        isProcessingRef.current = false
      }

      if (handsInstanceRef.current && rawVideoRef.current && rawVideoRef.current.readyState >= 2) {
        try {
          await handsInstanceRef.current.send({ image: rawVideoRef.current });
        } catch (err) {
          console.error("Sign language pipeline: Error running MediaPipe hands tracker:", err);
        }
      }
    }
    drawLoopWorkerRef.current.postMessage('start');
    
    return videoTrack
  }

  // Helper to dynamically get local tracks to send (screen share if active, otherwise camera)
  const getLocalTracksToSend = () => {
    const tracks = []
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) tracks.push(audioTrack)
    
    const videoTrack = (screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0)
      ? screenStreamRef.current.getVideoTracks()[0]
      : localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) tracks.push(videoTrack)
    
    return tracks
  }

  // Get local user media (camera and microphone) based on active states
  const startLocalStream = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      const stream = new MediaStream()
      localStreamRef.current = stream
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        if (enableSignTranslation && rawCameraStreamRef.current) {
          localVideoRef.current.srcObject = rawCameraStreamRef.current
        } else {
          localVideoRef.current.srcObject = stream
        }
      }

      if (videoEnabled) {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        let videoTrack = videoStream.getVideoTracks()[0]
        
        if (enableSignTranslation) {
          videoTrack = setupSignTranslationPipeline(videoTrack)
        }
        
        stream.addTrack(videoTrack)
      }
      
      if (audioEnabled) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioTrack = audioStream.getAudioTracks()[0]
        stream.addTrack(audioTrack)
      }
    } catch (error) {
      console.error("Error accessing media devices:", error)
      toast.error("Could not access camera or microphone. Please grant permissions.")
    }
  }

  // Handle toggles before/during call (completely stop tracks to turn camera light off)
  const toggleVideo = async () => {
    const nextState = !videoEnabled
    setVideoEnabled(nextState)

    if (nextState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        let track = stream.getVideoTracks()[0]
        
        if (enableSignTranslation) {
          track = setupSignTranslationPipeline(track)
        }
        
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => {
            t.stop()
            localStreamRef.current.removeTrack(t)
          })
          localStreamRef.current.addTrack(track)
        } else {
          localStreamRef.current = new MediaStream([track])
        }

        const newStream = new MediaStream(localStreamRef.current.getTracks())
        localStreamRef.current = newStream
        setLocalStream(newStream)

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream
        }

        // Update track on all active peer connections
        peerConnectionsRef.current.forEach(async (pc, socketId) => {
          try {
            // Only replace track if we are NOT currently screensharing
            if (!screenStreamRef.current) {
              const videoTransceiver = pc.getTransceivers().find(t => (t.sender.track && t.sender.track.kind === 'video') || (t.receiver.track && t.receiver.track.kind === 'video'))
              const videoSender = videoTransceiver?.sender
              if (videoSender) {
                await videoSender.replaceTrack(track)
              } else {
                pc.addTrack(track, localStreamRef.current)
              }
            }
          } catch (err) {
            console.error(`Error replacing video track for peer ${socketId}:`, err)
          }
        })
      } catch (error) {
        console.error("Error enabling camera:", error)
        toast.error("Could not access camera.")
        setVideoEnabled(false)
      }
    } else {
      cleanupSignTranslation()
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop()
          localStreamRef.current.removeTrack(track)
        })
      }
      
      const newStream = localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null
      localStreamRef.current = newStream
      setLocalStream(newStream)
      
      // Update track on all active peer connections
      peerConnectionsRef.current.forEach(async (pc, socketId) => {
        try {
          if (!screenStreamRef.current) {
            const videoTransceiver = pc.getTransceivers().find(t => (t.sender.track && t.sender.track.kind === 'video') || (t.receiver.track && t.receiver.track.kind === 'video'))
            const videoSender = videoTransceiver?.sender
            if (videoSender) {
              await videoSender.replaceTrack(null)
            }
          }
        } catch (err) {
          console.error(`Error removing video track for peer ${socketId}:`, err)
        }
      })
    }

    // Broadcast state toggle to other peers
    if (socketRef.current) {
      socketRef.current.emit("media-state-toggle", {
        type: 'video',
        enabled: nextState,
        roomId
      })
    }
  }

  const toggleAudio = async () => {
    const nextState = !audioEnabled
    setAudioEnabled(nextState)

    if (nextState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const track = stream.getAudioTracks()[0]

        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => {
            t.stop()
            localStreamRef.current.removeTrack(t)
          })
          localStreamRef.current.addTrack(track)
        } else {
          localStreamRef.current = new MediaStream([track])
        }

        const newStream = new MediaStream(localStreamRef.current.getTracks())
        localStreamRef.current = newStream
        setLocalStream(newStream)

        // Update track on all active peer connections
        peerConnectionsRef.current.forEach(async (pc, socketId) => {
          try {
            const audioTransceiver = pc.getTransceivers().find(t => (t.sender.track && t.sender.track.kind === 'audio') || (t.receiver.track && t.receiver.track.kind === 'audio'))
            const audioSender = audioTransceiver?.sender
            if (audioSender) {
              await audioSender.replaceTrack(track)
            } else {
              pc.addTrack(track, localStreamRef.current)
            }
          } catch (err) {
            console.error(`Error replacing audio track for peer ${socketId}:`, err)
          }
        })
      } catch (error) {
        console.error("Error enabling microphone:", error)
        toast.error("Could not access microphone.")
        setAudioEnabled(false)
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop()
          localStreamRef.current.removeTrack(track)
        })
      }

      const newStream = localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null
      localStreamRef.current = newStream
      setLocalStream(newStream)

      // Update track on all active peer connections
      peerConnectionsRef.current.forEach(async (pc, socketId) => {
        try {
          const audioTransceiver = pc.getTransceivers().find(t => (t.sender.track && t.sender.track.kind === 'audio') || (t.receiver.track && t.receiver.track.kind === 'audio'))
          const audioSender = audioTransceiver?.sender
          if (audioSender) {
            await audioSender.replaceTrack(null)
          }
        } catch (err) {
          console.error(`Error removing audio track for peer ${socketId}:`, err)
        }
      })
    }

    // Broadcast state toggle to other peers
    if (socketRef.current) {
      socketRef.current.emit("media-state-toggle", {
        type: 'audio',
        enabled: nextState,
        roomId
      })
    }
  }

  // Initialize socket connection and stream preview on mount / url param change
  useEffect(() => {
    if (urlRoomId) {
      setRoomId(urlRoomId)
    }
    
    startLocalStream()

    return () => {
      cleanupCall()
    }
  }, [urlRoomId])

  // Sync media streams to video elements whenever they are mounted or updated
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Clean up all streams and socket connections
  const cleanupCall = () => {
    cleanupSignTranslation()
    
    // Stop local camera stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    // Stop screen share stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, socketId) => {
      try {
        pc.close()
      } catch (err) {
        console.error(`Error closing peer connection for ${socketId}:`, err)
      }
    })
    peerConnectionsRef.current.clear()

    // Clear ICE candidates queue
    iceCandidatesQueueRef.current.clear()
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    setLocalStream(null)
    setPeers([])
    setIsScreenSharing(false)
    setInCall(false)
    setCallStatus('idle')
    setMessages([])
  }

  const handlePeerDisconnect = (socketId) => {
    if (peerConnectionsRef.current.has(socketId)) {
      try {
        peerConnectionsRef.current.get(socketId).close()
      } catch (e) {}
      peerConnectionsRef.current.delete(socketId)
    }
    peerRolesRef.current.delete(socketId)
    iceCandidatesQueueRef.current.delete(socketId)
    setPeers(prev => prev.filter(p => p.socketId !== socketId))
  }

  // Set up RTCPeerConnection and stream event handlers
  const createPeerConnection = (remoteSocketId, isInitiator = false, joinedUser) => {
    // If we already have a connection for this remote socket, close it first
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      try {
        peerConnectionsRef.current.get(remoteSocketId).close()
      } catch (e) {}
      peerConnectionsRef.current.delete(remoteSocketId)
    }

    const pc = new RTCPeerConnection(peerConfiguration)
    peerConnectionsRef.current.set(remoteSocketId, pc)
    peerRolesRef.current.set(remoteSocketId, isInitiator)

    // Negotiate tracks using addTrack to natively generate transceivers and preserve MSIDs
    if (isInitiator) {
      getLocalTracksToSend().forEach(track => {
        try { pc.addTrack(track, localStreamRef.current) } catch (e) {}
      })
    }

    // (WebRTC DataChannel removed in favor of Socket.io for sign translation reliability)

    // Set remote track handler
    pc.ontrack = (event) => {
      console.log(`Received remote track for ${remoteSocketId}:`, event.track)
      
      // Tag the track with its transceiver MID so we can explicitly match it later
      // Safari rewrites track.id, so MID is the only cryptographically stable identifier across the network
      if (event.transceiver && event.transceiver.mid) {
        event.track._mid = event.transceiver.mid;
      }
      
      setPeers(prev => {
        const peerIndex = prev.findIndex(p => p.socketId === remoteSocketId)
        if (peerIndex !== -1) {
          const updatedPeers = [...prev]
          const existingPeer = updatedPeers[peerIndex]
          
          let currentStream = existingPeer.stream
          if (!currentStream) {
            currentStream = (event.streams && event.streams.length > 0) ? event.streams[0] : new MediaStream()
          }
          
          const previousTrackCount = currentStream.getTracks().length;
          
          if (!currentStream.getTracks().includes(event.track)) {
            currentStream.addTrack(event.track)
          }
          
          updatedPeers[peerIndex] = {
            ...existingPeer,
            stream: currentStream.getTracks().length !== previousTrackCount ? new MediaStream(currentStream.getTracks()) : currentStream
          }
          return updatedPeers
        } else {
          let newStream
          if (event.streams && event.streams.length > 0) {
            newStream = event.streams[0]
          } else {
            newStream = new MediaStream([event.track])
          }
          
          return [
            ...prev,
            {
              socketId: remoteSocketId,
              user: joinedUser,
              stream: newStream,
              videoEnabled: joinedUser?.videoEnabled ?? false,
              audioEnabled: joinedUser?.audioEnabled ?? false
            }
          ]
        }
      })

      event.track.onmute = () => {
        setPeers(prev => {
          return prev.map(p => {
            if (p.socketId === remoteSocketId) {
              return {
                ...p,
                videoEnabled: event.track.kind === 'video' ? false : p.videoEnabled,
                audioEnabled: event.track.kind === 'audio' ? false : p.audioEnabled
              }
            }
            return p
          })
        })
      }

      event.track.onunmute = () => {
        setPeers(prev => {
          return prev.map(p => {
            if (p.socketId === remoteSocketId) {
              return {
                ...p,
                videoEnabled: event.track.kind === 'video' ? true : p.videoEnabled,
                audioEnabled: event.track.kind === 'audio' ? true : p.audioEnabled
              }
            }
            return p
          })
        })
      }

      setCallStatus('connected')
    }

    // Exchange ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          candidate: event.candidate,
          targetId: remoteSocketId
        })
      }
    }

    pc.oniceconnectionstatechange = async () => {
      console.log(`ICE Connection State for ${remoteSocketId}:`, pc.iceConnectionState)
      if (pc.iceConnectionState === 'failed') {
        // Attempt ICE Restart to auto-recover the video stream
        toast.error(`Connection failed with ${joinedUser?.fullName || 'Peer'}. Auto-reconnecting...`, { id: `reconnect-${remoteSocketId}` })
        if (isInitiator) {
          try {
            const offer = await pc.createOffer({ iceRestart: true })
            await pc.setLocalDescription(offer)
            if (socketRef.current) {
              socketRef.current.emit("webrtc-offer", { 
                offer, 
                targetId: remoteSocketId,
                user: joinedUser || { fullName: 'Peer' }
              })
            }
          } catch(e) { console.error("ICE restart failed", e) }
        }
      } else if (pc.iceConnectionState === 'closed') {
        handlePeerDisconnect(remoteSocketId)
      } else if (pc.iceConnectionState === 'disconnected') {
        toast.error(`Poor connection with ${joinedUser?.fullName || 'Peer'}. Attempting to reconnect...`, { id: `reconnect-${remoteSocketId}` })
      } else if (pc.iceConnectionState === 'connected') {
        toast.dismiss(`reconnect-${remoteSocketId}`)
      }
    }

    return pc
  }

  // Join video call room
  const joinCall = async (e) => {
    if (e) e.preventDefault()
    if (!roomId.trim()) {
      toast.error("Please enter a valid Room ID")
      return
    }

    // Ensure we have local stream active
    if (!localStreamRef.current) {
      await startLocalStream()
    }

    setInCall(true)
    setCallStatus('connecting')
    
    // Connect to Socket.io Signaling server
    const socket = io(SOCKET_URL)
    socketRef.current = socket

    socket.on("connect", () => {
      console.log("Connected to signaling server with ID:", socket.id)
      socket.emit("join-room", { 
        roomId, 
        user: {
          fullName: user?.fullName || 'Anonymous User',
          imageUrl: user?.imageUrl || '',
          role: isTeacher ? 'teacher' : 'student',
          videoEnabled,
          audioEnabled
        } 
      })
    })

    socket.on("sign-translation", ({ text, senderId }) => {
      setPeers(prev => prev.map(p => p.socketId === senderId ? { ...p, signTranslationText: text } : p))
    })

    socket.on("error-message", (data) => {
      toast.error(data.message)
      cleanupCall()
    })

    // Handle room full condition
    socket.on("room-full", () => {
      toast.error("This call room is full (maximum 3 participants).")
      cleanupCall()
    })

    // Successfully joined room
    socket.on("joined-room", async ({ roomId, existingUsers }) => {
      console.log("Successfully joined room:", roomId, "Existing users:", existingUsers)
      toast.success(`Joined room: ${roomId}`)
      
      if (existingUsers && existingUsers.length > 0) {
        for (const existingUser of existingUsers) {
          // Add them to peers state first so their card renders (even before remote stream starts)
          setPeers(prev => {
            if (prev.some(p => p.socketId === existingUser.socketId)) return prev
            return [
              ...prev,
              {
                socketId: existingUser.socketId,
                user: existingUser.user,
                stream: null,
                videoEnabled: existingUser.user.videoEnabled,
                audioEnabled: existingUser.user.audioEnabled,
                isScreenSharing: existingUser.user.isScreenSharing || false,
                activeVideoMid: existingUser.user.activeVideoMid || null
              }
            ]
          })

          const pc = createPeerConnection(existingUser.socketId, true, existingUser.user)
          try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socket.emit("webrtc-offer", { 
              offer, 
              targetId: existingUser.socketId,
              user: {
                fullName: user?.fullName || 'Anonymous User',
                imageUrl: user?.imageUrl || '',
                videoEnabled,
                audioEnabled
              }
            })
          } catch (error) {
            console.error(`Error creating offer for peer ${existingUser.socketId}:`, error)
          }
        }
      }
    })

    // Peer joined (we receive user-joined since we were already in the room)
    socket.on("user-joined", ({ socketId, user: joinedUser }) => {
      console.log("Peer user joined:", joinedUser)
      toast.success(`${joinedUser.fullName} joined the call`)

      setPeers(prev => {
        if (prev.some(p => p.socketId === socketId)) return prev
        return [
          ...prev,
          {
            socketId,
            user: joinedUser,
            stream: null,
            videoEnabled: joinedUser.videoEnabled,
            audioEnabled: joinedUser.audioEnabled,
            isScreenSharing: joinedUser.isScreenSharing || false,
            activeVideoMid: joinedUser.activeVideoMid || null
          }
        ]
      })
      // We do not initiate the connection here (joinedUser is the one who joined, so they will send the offer)
    })

    // Receiver logic (receives WebRTC Offer, sends WebRTC Answer)
    socket.on("webrtc-offer", async ({ offer, senderId, user: offerUser, screenShareMid, isScreenSharing }) => {
      console.log("Received WebRTC offer from:", senderId, offerUser)
      
      setPeers(prev => {
        if (prev.some(p => p.socketId === senderId)) {
          return prev.map(p => {
            if (p.socketId === senderId) {
              return { 
                ...p, 
                user: { ...p.user, ...offerUser },
                ...(offerUser?.videoEnabled !== undefined && { videoEnabled: offerUser.videoEnabled }),
                ...(offerUser?.audioEnabled !== undefined && { audioEnabled: offerUser.audioEnabled }),
                // Use explicitly provided MIDs from the Initiator to perfectly sync the VideoCard React player
                // with the correct incoming WebRTC transceiver
                ...(screenShareMid !== undefined && { activeVideoMid: screenShareMid }),
                ...(isScreenSharing !== undefined && { isScreenSharing })
              }
            }
            return p
          })
        }
        return [
          ...prev,
          {
            socketId: senderId,
            user: offerUser,
            stream: null,
            videoEnabled: offerUser.videoEnabled,
            audioEnabled: offerUser.audioEnabled,
            isScreenSharing: isScreenSharing || false,
            activeVideoMid: screenShareMid || null
          }
        ]
      })

      let pc = peerConnectionsRef.current.get(senderId)
      if (!pc) {
        pc = createPeerConnection(senderId, false, offerUser)
      }
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        await processQueuedIceCandidates(senderId, pc)
        
        // Answerer configures transceivers generated by the offer
        // Answerer correctly adds tracks using addTrack to preserve MSID (Media Stream ID).
        // This ensures event.streams[0] natively populates on the Initiator's side, fixing React srcObject binding bugs.
        getLocalTracksToSend().forEach(track => {
          const senders = pc.getSenders()
          if (!senders.some(s => s.track === track)) {
            try { pc.addTrack(track, localStreamRef.current) } catch (e) {}
          }
        })

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        socket.emit("webrtc-answer", { 
          answer, 
          targetId: senderId,
          user: {
            fullName: user?.fullName || 'Anonymous User',
            imageUrl: user?.imageUrl || '',
            videoEnabled,
            audioEnabled
          }
        })
      } catch (error) {
        console.error("Error handling offer:", error)
      }
    })

    // Initiator logic (receives WebRTC Answer)
    socket.on("webrtc-answer", async ({ answer, senderId }) => {
      console.log("Received WebRTC answer from:", senderId)
      const pc = peerConnectionsRef.current.get(senderId)
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          await processQueuedIceCandidates(senderId, pc)
        } catch (error) {
          console.error("Error setting remote description from answer:", error)
        }
      }
    })

    // Exchange ICE Candidates
    socket.on("ice-candidate", async ({ candidate, senderId }) => {
      const pc = peerConnectionsRef.current.get(senderId)
      if (pc) {
        await addIceCandidateToPeer(senderId, pc, candidate)
      } else {
        if (!iceCandidatesQueueRef.current.has(senderId)) {
          iceCandidatesQueueRef.current.set(senderId, [])
        }
        iceCandidatesQueueRef.current.get(senderId).push(candidate)
      }
    })

    // Handle Text Chat messages
    socket.on("chat-message", ({ message, user: sender, timestamp }) => {
      setMessages(prev => [...prev, {
        senderName: sender.fullName,
        senderAvatar: sender.imageUrl,
        message,
        timestamp,
        isMe: false
      }])
      
      if (!isChatOpen) {
        setUnreadCount(prev => prev + 1)
        toast(`New message from ${sender.fullName}`, { icon: '💬' })
      }
    })

    // Handle media state toggles (audio, video, screen) from peers
    socket.on("media-state-toggle", ({ socketId, type, enabled, mid }) => {
      setPeers(prev => prev.map(p => {
        if (p.socketId === socketId) {
          if (type === 'video') return { ...p, videoEnabled: enabled }
          if (type === 'audio') return { ...p, audioEnabled: enabled }
          if (type === 'screen') {
            return { 
              ...p, 
              isScreenSharing: enabled,
              ...(mid !== undefined && { activeVideoMid: mid }),
              stream: p.stream ? new MediaStream(p.stream.getTracks()) : null 
            }
          }
        }
        return p
      }))
    })

    // Handle Peer user leaving
    socket.on("user-left", ({ socketId }) => {
      console.log("Peer user left call:", socketId)
      toast.error("A participant left the call")
      handlePeerDisconnect(socketId)
    })
  }

  // Send Text Message
  const sendChatMessage = (e) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !socketRef.current) return

    const msgObj = {
      message: newMessage,
      roomId,
      user: {
        fullName: user?.fullName || 'Anonymous User',
        imageUrl: user?.imageUrl || ''
      }
    }

    socketRef.current.emit("chat-message", msgObj)

    setMessages(prev => [...prev, {
      senderName: user?.fullName || 'You',
      senderAvatar: user?.imageUrl || '',
      message: newMessage,
      timestamp: new Date().toISOString(),
      isMe: true
    }])

    setNewMessage('')
  }

  // Handle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen share and revert to video track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }
      
      setIsScreenSharing(false)
      
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0]
      
      peerConnectionsRef.current.forEach(async (pc, socketId) => {
        try {
          let newTransceiverMid = null;
          
          const senders = pc.getSenders()
          const videoSenders = senders.filter(s => s.track && s.track.kind === 'video')
          videoSenders.forEach(s => {
            try { pc.removeTrack(s) } catch (e) {}
          })
          
          let newSender = null;
          if (cameraTrack) newSender = pc.addTrack(cameraTrack, localStreamRef.current)
          
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          
          if (newSender) {
            const newTransceiver = pc.getTransceivers().find(t => t.sender === newSender)
            if (newTransceiver) newTransceiverMid = newTransceiver.mid;
          }
          
          socketRef.current.emit("webrtc-offer", { 
            targetId: socketId, 
            offer, 
            screenShareMid: newTransceiverMid,
            isScreenSharing: false,
            user: { fullName: user?.fullName || 'Anonymous User', imageUrl: user?.imageUrl || '', videoEnabled, audioEnabled } 
          })
        } catch (err) {
          console.error(`Error swapping back to camera for peer ${socketId}:`, err)
        }
      })
      
      // Broadcast screen share stop
      if (socketRef.current) {
        socketRef.current.emit("media-state-toggle", { type: 'screen', enabled: false, roomId })
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]

        setIsScreenSharing(true)

        // Replace local video track with screen share track
        peerConnectionsRef.current.forEach(async (pc, socketId) => {
          try {
            let newTransceiverMid = null;
            
            // Safari/Chrome bug: replaceTrack fails silently on massive resolution jumps.
            // We MUST use removeTrack and addTrack to force a completely new transceiver and hardware decoder state.
            const senders = pc.getSenders()
            const videoSenders = senders.filter(s => s.track && s.track.kind === 'video')
            videoSenders.forEach(s => {
              try { pc.removeTrack(s) } catch (e) {}
            })
            
            const newSender = pc.addTrack(screenTrack, localStreamRef.current)
            
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            
            // Get the MID of the new transceiver after setting local description
            const newTransceiver = pc.getTransceivers().find(t => t.sender === newSender)
            if (newTransceiver) {
              newTransceiverMid = newTransceiver.mid;
            }
            
            socketRef.current.emit("webrtc-offer", {
              targetId: socketId,
              offer,
              screenShareMid: newTransceiverMid,
              isScreenSharing: true,
              user: {
                fullName: user?.fullName || 'Anonymous User',
                imageUrl: user?.imageUrl || '',
                videoEnabled,
                audioEnabled
              }
            })
            
            // Note: We deliberately do NOT emit media-state-toggle here to avoid global broadcast collisions
            // where 5 separate transceivers cause 25 total events overriding each other.
          } catch (err) {
            console.error(`Error swapping to screen share track for peer ${socketId}:`, err)
          }
        })

        // Listen for screen share stop from browser toolbars
        screenTrack.onended = async () => {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop())
            screenStreamRef.current = null
          }
          setIsScreenSharing(false)
          const camTrack = localStreamRef.current?.getVideoTracks()[0]
          peerConnectionsRef.current.forEach(async (pc, socketId) => {
            try {
              let newTransceiverMid = null;
              
              const senders = pc.getSenders()
              const videoSenders = senders.filter(s => s.track && s.track.kind === 'video')
              videoSenders.forEach(s => {
                try { pc.removeTrack(s) } catch (e) {}
              })
              
              let newSender = null;
              if (camTrack) newSender = pc.addTrack(camTrack, localStreamRef.current)
              
              const offer = await pc.createOffer()
              await pc.setLocalDescription(offer)
              
              if (newSender) {
                const newTransceiver = pc.getTransceivers().find(t => t.sender === newSender)
                if (newTransceiver) newTransceiverMid = newTransceiver.mid;
              }
              
              socketRef.current.emit("webrtc-offer", { 
                targetId: socketId, 
                offer, 
                screenShareMid: newTransceiverMid,
                isScreenSharing: false,
                user: { fullName: user?.fullName || 'Anonymous User', imageUrl: user?.imageUrl || '', videoEnabled, audioEnabled } 
              })
              
            } catch (err) {
              console.error(`Error swapping back to camera for peer ${socketId}:`, err)
            }
          })
          
          if (socketRef.current) socketRef.current.emit("media-state-toggle", { roomId, type: 'screen', enabled: false })
        }
        
        if (socketRef.current) {
          socketRef.current.emit("media-state-toggle", { roomId, type: 'screen', enabled: true })
        }
      } catch (error) {
        console.error("Screen sharing error:", error)
        toast.error("Failed to share screen.")
      }
    }
  }

  // Generate random Room ID
  const generateRoomId = () => {
    const rand = Math.random().toString(36).substring(2, 7) + '-' + Math.random().toString(36).substring(2, 7)
    setRoomId(rand)
    toast.success("Generated new Room ID")
  }

  // Copy Room Link to clipboard
  const copyInviteLink = () => {
    if (!roomId) return
    const link = `${window.location.origin}/ai/video-call?room=${roomId}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("Invite link copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  // Leave active call
  const leaveCall = () => {
    if (socketRef.current) {
      socketRef.current.emit("leave-room", { roomId })
    }
    cleanupCall()
    toast.success("Call ended")
    setSearchParams({}) // Clear url param
  }

  return (
    <>
      {/* Hidden elements for Canvas streaming (MUST NOT use display:none or browser throttles to 1fps) */}
      <video ref={rawVideoRef} className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" autoPlay playsInline muted />
      <canvas ref={translationCanvasRef} width="640" height="480" className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" />
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className='h-full flex flex-col md:flex-row overflow-hidden text-white bg-transparent'>
        
        {/* LEFT: Lobby or Video Call Content */}
        <div className='flex-1 flex flex-col relative bg-transparent overflow-hidden h-full'>
        
        {!inCall ? (
          /* ==================== LOBBY STATE ==================== */
          <div className='flex-1 flex flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-6 lg:pt-24 gap-8 overflow-y-auto bg-transparent'>
            
            {/* Camera Preview */}
            <div className='w-full max-w-lg flex flex-col items-center gap-4 lg:gap-0 lg:pt-[44px] lg:relative'>
              <h2 className='text-white font-semibold text-lg self-start flex items-center gap-2 lg:absolute lg:top-0 lg:left-0 lg:h-[28px] drop-shadow-md'>
                <Sparkles className='w-5 text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.8)]' /> Camera & Mic Preview
              </h2>
              <div className='w-full aspect-video bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl overflow-hidden relative shadow-lg flex items-center justify-center'>
                {videoEnabled && localStream ? (
                  <>
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    {enableSignTranslation && currentSignTranslation && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 border border-emerald-500/30 text-emerald-400 font-bold text-3xl px-6 py-3 rounded-xl pointer-events-none z-20 backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        {currentSignTranslation}
                      </div>
                    )}
                  </>
                ) : (
                  <div className='flex flex-col items-center gap-3 text-slate-400'>
                    <div className='w-16 h-16 rounded-full bg-black/40 border border-white/5 flex justify-center items-center'>
                      <VideoOff className='w-8 opacity-50' />
                    </div>
                    <p className='text-sm font-medium'>Your camera is disabled</p>
                  </div>
                )}
                
                {/* Floating controls in preview */}
                <div className='absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg'>
                  <button 
                    onClick={toggleAudio}
                    className={`p-3 rounded-full transition-all duration-200 cursor-pointer ${audioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                  >
                    {audioEnabled ? <Mic className='w-5' /> : <MicOff className='w-5' />}
                  </button>
                  <button 
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-all duration-200 cursor-pointer ${videoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white'}`}
                  >
                    {videoEnabled ? <Video className='w-5' /> : <VideoOff className='w-5' />}
                  </button>
                </div>
              </div>
            </div>

            {/* Joining Form Column Wrapper */}
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className='w-full max-w-md flex flex-col lg:pt-[44px]'>
              
              {/* Joining Form */}
              <div className='w-full bg-white/5 border border-white/10 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-xl text-white'>
                <div className='mb-6'>
                  <h1 className='text-2xl font-bold text-white drop-shadow-md flex items-center gap-2'>
                    Group Video Call
                  </h1>
                  <p className='text-slate-400 text-sm mt-1'>
                    Connect instantly with high-fidelity WebRTC call (up to 3 people).
                  </p>
                </div>

                <form onSubmit={joinCall} className='space-y-5'>
                  <div>
                    <label className='block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2'>
                      Room ID / Invite Code
                    </label>
                    <div className='flex flex-col sm:flex-row gap-2'>
                      <input 
                        type="text" 
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.trim().toLowerCase())}
                        placeholder="e.g. room-abc-123"
                        className='flex-1 bg-black/40 border border-white/10 text-white placeholder-slate-500 px-4 py-3 rounded-xl focus:border-purple-500 focus:bg-black/60 focus:outline-none text-sm font-mono'
                        required
                      />
                      {isTeacher && (
                        <button
                          type="button"
                          onClick={generateRoomId}
                          className='px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer'
                          title="Generate random Room ID"
                        >
                          Generate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sign Language Checkbox */}
                  <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 transition-all hover:bg-purple-500/20 backdrop-blur-sm">
                    <input 
                      type="checkbox" 
                      id="signTranslate"
                      checked={enableSignTranslation}
                      onChange={(e) => {
                        setEnableSignTranslation(e.target.checked)
                        toast.success(e.target.checked ? "Sign Language Translation Enabled! Turn camera off and on to apply." : "Sign Language Translation Disabled")
                      }}
                      className="w-4 h-4 text-purple-500 rounded cursor-pointer accent-purple-500"
                    />
                    <label htmlFor="signTranslate" className="text-sm font-medium text-purple-300 cursor-pointer flex-1">
                      Enable Live Sign Language Translation
                    </label>
                  </div>

                  {roomId && (
                    <div className='p-3 bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl flex items-center justify-between'>
                      <div className='overflow-hidden pr-2'>
                        <p className='text-[10px] text-purple-400 font-semibold uppercase tracking-wider'>Shareable Link</p>
                        <p className='text-xs text-slate-300 font-mono truncate'>
                          {window.location.origin}/ai/video-call?room={roomId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        className='p-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 rounded-lg transition-all cursor-pointer border border-purple-500/30'
                        title="Copy Invite Link"
                      >
                        {copied ? <Check className='w-4 h-4 text-emerald-400' /> : <Copy className='w-4 h-4' />}
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    className='w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-95 text-white py-3.5 px-4 rounded-xl font-semibold shadow-[0_0_15px_rgba(79,70,229,0.4)] text-sm transition-all duration-300 cursor-pointer flex justify-center items-center gap-2'
                  >
                    <Video className='w-4' /> Join Call Room
                  </button>
                </form>
              </div>
            </motion.div>

          </div>
        ) : (
          /* ==================== ACTIVE CALL STATE ==================== */
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className='flex-1 flex flex-col relative justify-between h-full bg-transparent'>
            
            {/* Floating Info Overlay (top bar) */}
            <div className='absolute top-4 left-4 z-20 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 text-white shadow-lg text-sm'>
              <span className={`w-2 h-2 rounded-full ${peers.length > 0 ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]'}`} />
              <span className='font-mono font-semibold text-xs text-white drop-shadow-sm'>Room: {roomId}</span>
              <button 
                onClick={copyInviteLink}
                className='ml-2 text-slate-400 hover:text-white transition-all cursor-pointer'
                title="Copy Room Link"
              >
                <Copy className='w-3.5 h-3.5' />
              </button>
            </div>

            {/* Video Streams Container */}
            <div className='flex-1 w-full relative flex items-start lg:items-center justify-center p-4 min-h-0 overflow-y-auto'>
              <div className={`grid grid-cols-1 ${
                peers.length === 0 ? 'md:grid-cols-2' : 
                peers.length === 1 ? 'md:grid-cols-2' : 
                'md:grid-cols-3'
              } gap-6 max-w-5xl mx-auto w-full items-center justify-items-center`}>
                {/* Local Video Card */}
                <VideoCard
                  stream={localStream}
                  rawStream={rawCameraStreamRef.current}
                  screenStream={screenStreamRef.current}
                  isScreenSharing={isScreenSharing}
                  isSignTranslationEnabled={enableSignTranslation}
                  signTranslationText={enableSignTranslation ? currentSignTranslation : undefined}
                  isLocal={true}
                  userObj={{
                    fullName: user?.fullName || 'You',
                    imageUrl: user?.imageUrl || ''
                  }}
                  isVideoEnabled={videoEnabled}
                  isAudioEnabled={audioEnabled}
                />

                {/* Remote Video Cards */}
                {peers.map((peer) => (
                  <VideoCard
                    key={peer.socketId}
                    stream={peer.stream}
                    screenStream={null}
                    isScreenSharing={peer.isScreenSharing || false}
                    isLocal={false}
                    signTranslationText={peer.signTranslationText}
                    userObj={peer.user}
                    isVideoEnabled={peer.videoEnabled !== false}
                    isAudioEnabled={peer.audioEnabled !== false}
                    activeVideoMid={peer.activeVideoMid}
                  />
                ))}

                {/* Waiting Card if no other peers are present */}
                {peers.length === 0 && (
                  <div className='relative w-full aspect-video bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg flex flex-col items-center justify-center text-center p-6 min-h-[180px]'>
                    <div className='w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 flex justify-center items-center mb-3 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]'>
                      <User className='w-6 h-6' />
                    </div>
                    <h4 className='text-white font-bold text-sm mb-1 drop-shadow-sm'>Waiting for peer...</h4>
                    <p className='text-xs text-slate-400 max-w-xs mb-4'>Share this room ID or invite link with another person to start the video call.</p>
                    <div className='flex gap-2 w-full max-w-xs justify-center'>
                      <button
                        onClick={copyInviteLink}
                        className='flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-lg'
                      >
                        <Copy className='w-3.5 h-3.5' /> Copy Invite Link
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CALL CONTROLS ACTION BAR */}
            <div className='w-full py-6 flex justify-center items-center z-10 px-4'>
              <div className='flex flex-wrap justify-center items-center gap-2 sm:gap-4 px-4 sm:px-6 py-2 sm:py-3.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.5)]'>
                
                {/* Mic toggle */}
                <button
                  onClick={toggleAudio}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer ${audioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                  title={audioEnabled ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {audioEnabled ? <Mic className='w-5' /> : <MicOff className='w-5' />}
                </button>

                {/* Video toggle */}
                <button
                  onClick={toggleVideo}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer ${videoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                  title={videoEnabled ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {videoEnabled ? <Video className='w-5' /> : <VideoOff className='w-5' />}
                </button>

                {/* Screen Share toggle - Only for Teachers */}
                {isTeacher && (
                  <button
                    onClick={toggleScreenShare}
                    className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer ${isScreenSharing ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    title={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
                    disabled={false}
                  >
                    {isScreenSharing ? <MonitorOff className='w-5' /> : <Monitor className='w-5' />}
                  </button>
                )}

                {/* Open Chat toggle */}
                <button
                  onClick={() => setIsChatOpen(prev => !prev)}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer relative ${isChatOpen ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title="Open Chat"
                >
                  <MessageSquare className='w-5' />
                  {unreadCount > 0 && (
                    <span className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce border-2 border-white/20 shadow-md'>
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Separator */}
                <span className='w-[1px] h-8 bg-white/20' />

                {/* End call button */}
                <button
                  onClick={leaveCall}
                  className='p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-full transition-all duration-200 shadow-[0_0_15px_rgba(220,38,38,0.6)] cursor-pointer transform hover:scale-110 active:scale-95'
                  title="End Video Call"
                >
                  <PhoneOff className='w-5' />
                </button>

              </div>
            </div>

          </motion.div>
        )}

        </div>

      {/* RIGHT: Sliding Text Chat Drawer */}
      {inCall && isChatOpen && (
        <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className='absolute bottom-0 left-0 right-0 z-50 md:static md:z-auto w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-[70vh] md:h-full shadow-2xl transition-all duration-300'>
          
          {/* Chat Header */}
          <div className='p-4 border-b border-white/10 flex justify-between items-center bg-black/40'>
            <div className='flex items-center gap-2'>
              <MessageSquare className='w-4 text-blue-400 drop-shadow-sm' />
              <h3 className='font-semibold text-sm text-white'>Live Chat</h3>
            </div>
            <button 
              onClick={() => setIsChatOpen(false)}
              className='text-slate-400 hover:text-white cursor-pointer transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Messages List */}
          <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-transparent'>
            {messages.length === 0 ? (
              <div className='h-full flex flex-col items-center justify-center text-center text-slate-400 p-4 gap-2'>
                <MessageSquare className='w-8 h-8 opacity-40' />
                <p className='text-xs'>No messages yet. Send a message to get started!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-2.5 ${msg.isMe ? 'flex-row-reverse' : ''}`}>
                  <img 
                    src={msg.senderAvatar || 'https://via.placeholder.com/150'} 
                    alt={msg.senderName} 
                    className='w-7 h-7 rounded-full object-cover border border-white/10 shadow-sm' 
                  />
                  <div className='flex flex-col max-w-[75%]'>
                    <span className={`text-[10px] text-slate-400 mb-0.5 ${msg.isMe ? 'text-right' : ''}`}>
                      {msg.isMe ? 'You' : msg.senderName}
                    </span>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md ${msg.isMe ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none' : 'bg-white/10 backdrop-blur-md text-white rounded-tl-none border border-white/5'}`}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={sendChatMessage} className='p-3 border-t border-white/10 bg-black/40 flex gap-2'>
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type message..."
              className='flex-1 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50 focus:bg-white/5 placeholder-slate-500 bg-black/40 text-white transition-colors'
            />
            <button
              type="submit"
              className='p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-95'
            >
              <Send className='w-3.5 h-3.5' />
            </button>
          </form>

        </motion.div>
      )}

      </motion.div>
    </>
  )
}

export default VideoCall
