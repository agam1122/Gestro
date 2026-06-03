import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import { io } from 'socket.io-client'
import axios from 'axios'
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
  X,
  Eraser,
  Hash,
  Palette,
  BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'
import html2pdf from 'html2pdf.js'
import { getSocketUrl } from '../utils/resolveUrl'

// Single Video Card Component for Responsive Grid
const VideoCard = ({ stream, screenStream, isScreenSharing, isSignTranslationEnabled, isLocal, userObj, isVideoEnabled, isAudioEnabled, rawStream, signTranslationText, activeVideoMid, minHeightClass = 'min-h-[180px]' }) => {
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
    <div className={`relative w-full aspect-video bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-lg flex items-center justify-center ${minHeightClass}`}>
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

const SOCKET_URL = getSocketUrl()

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

// Global MediaPipe Hands instance to prevent multiple WebAssembly initialization crashes (EEXIST / Module.arguments)
let globalHandsInstance = null;
let globalHandsPromise = null;

const getGlobalHandsInstance = () => {
  if (globalHandsInstance) {
    return Promise.resolve(globalHandsInstance);
  }
  if (globalHandsPromise) {
    return globalHandsPromise;
  }

  globalHandsPromise = new Promise((resolve) => {
    console.log("Sign language pipeline: Initializing global MediaPipe Hands instance...");
    const hands = new window.Hands({
      locateFile: (file) => {
        // Force non-SIMD WebAssembly binaries to resolve memory limits / out of bounds errors
        // on Safari, Firefox, and older browser engines
        const targetFile = file.replace("hands_solution_simd_wasm_bin", "hands_solution_wasm_bin");
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${targetFile}`;
      }
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });
    
    resolve(hands);
  });

  return globalHandsPromise.then((hands) => {
    globalHandsInstance = hands;
    return hands;
  });
};

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

  const location = useLocation()
  const navigate = useNavigate()
  const isCallRoute = location.pathname === '/ai/video-call'

  // UI State
  const [roomId, setRoomId] = useState(urlRoomId)
  const [inCall, setInCall] = useState(false)
  const [callStatus, setCallStatus] = useState('idle') // idle, lobby, connecting, connected, full
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [enableSignTranslation, setEnableSignTranslation] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenShareRequestStatus, setScreenShareRequestStatus] = useState('idle') // idle, requested, approved
  const [currentSignTranslation, setCurrentSignTranslation] = useState("")
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [transcripts, setTranscripts] = useState([])
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [brushColor, setBrushColor] = useState('#ffffff')
  const [brushSize, setBrushSize] = useState(4)
  const [isEraser, setIsEraser] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('classroom_notes_' + urlRoomId) || ''
  })

  // Auto-save notes to localStorage
  useEffect(() => {
    if (roomId) {
      localStorage.setItem('classroom_notes_' + roomId, notes)
    }
  }, [notes, roomId])
  
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
  const audioContextRef = useRef(null)
  const recognitionRef = useRef(null)
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
  const isMediaPipeProcessingRef = useRef(false)
  const hasMediaPipeCrashedRef = useRef(false)
  const consecutiveCrashesRef = useRef(0)
  const activeRoomIdRef = useRef(roomId)
  const whiteboardCanvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastDrawingCoordsRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    activeRoomIdRef.current = roomId
  }, [roomId])

  useEffect(() => {
    return () => {
      // Set empty results callback to avoid memory leaks on unmount
      if (globalHandsInstance) {
        try {
          globalHandsInstance.onResults(() => {});
        } catch (e) {
          console.error("Error resetting results callback on unmount:", e)
        }
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
    if (globalHandsInstance) {
      console.log("Sign language pipeline: Resetting MediaPipe Hands callback on cleanup")
      try {
        globalHandsInstance.onResults(() => {});
      } catch (e) {
        console.error("Error resetting hands callback:", e)
      }
    }
    latestLandmarksRef.current = null
    latestLetterRef.current = ""
    setCurrentSignTranslation("")
    isProcessingRef.current = false
    isMediaPipeProcessingRef.current = false
    hasMediaPipeCrashedRef.current = false
  }

  const setupSignTranslationPipeline = (videoTrack) => {
    cleanupSignTranslation()
    
    rawCameraStreamRef.current = new MediaStream([videoTrack])
    if (rawVideoRef.current) {
      rawVideoRef.current.srcObject = rawCameraStreamRef.current
      rawVideoRef.current.play().catch(e => console.log('play error', e))
    }

    const wsHost = window.location.hostname
    const isLocalHost = wsHost === 'localhost' || wsHost === '127.0.0.1' || wsHost.startsWith('10.') || wsHost.startsWith('192.168.') || wsHost.startsWith('172.')
    const defaultWsUrl = isLocalHost 
      ? `ws://${wsHost}:8000/ws/detect_dynamic` 
      : `wss://${wsHost}/ws/detect_dynamic`
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

    // Lazy-initialize global singleton MediaPipe Hands client-side
    if (window.Hands) {
      getGlobalHandsInstance().then((hands) => {
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
      });
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
      if (hasMediaPipeCrashedRef.current) return;
      const now = Date.now()
      
      // Safety reset: if we've been processing for > 2000ms, assume frame was lost and reset lock
      if (isMediaPipeProcessingRef.current && (now - lastFrameSentTimeRef.current > 2000)) {
        console.warn("Sign language pipeline: MediaPipe processing timeout. Resetting tracking flag.")
        isMediaPipeProcessingRef.current = false
      }

      if (isMediaPipeProcessingRef.current) {
        // Skip frame if MediaPipe is still busy with the previous frame or loading dependencies
        return
      }

      if (globalHandsInstance && rawVideoRef.current && rawVideoRef.current.readyState >= 2 && translationCanvasRef.current) {
        try {
          isMediaPipeProcessingRef.current = true
          lastFrameSentTimeRef.current = now
          
          const canvas = translationCanvasRef.current
          const ctx = canvas.getContext("2d")
          ctx.drawImage(rawVideoRef.current, 0, 0, canvas.width, canvas.height)
          
          await globalHandsInstance.send({ image: canvas });
          
          isMediaPipeProcessingRef.current = false
          consecutiveCrashesRef.current = 0
        } catch (err) {
          console.error("Sign language pipeline: Error running MediaPipe hands tracker:", err);
          const errStr = err ? err.toString() : "";
          
          consecutiveCrashesRef.current = (consecutiveCrashesRef.current || 0) + 1;
          
          if (consecutiveCrashesRef.current > 15) {
            console.error("Sign language pipeline: Critical WASM crash limit reached. Halting tracking loop.");
            hasMediaPipeCrashedRef.current = true;
            toast.error("Sign language translation failed to initialize. Please check your connection and reload the page.");
          } else {
            // Keep trying - reset processing flag so next frames can try after a short delay
            isMediaPipeProcessingRef.current = false;
          }
        }
      }
    }
    
    // Add a 5-second safety delay to allow MediaPipe's WASM binary and model assets (.tflite, .data)
    // to finish downloading and compiling before flooding the worker queue.
    setTimeout(() => {
      if (drawLoopWorkerRef.current && !hasMediaPipeCrashedRef.current) {
        console.log("Sign language pipeline: Starting frame loop after safety delay.");
        drawLoopWorkerRef.current.postMessage('start');
      }
    }, 5000);
    
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

  // Ensure both audio and video tracks are completely initialized and negotiated from the start
  const ensureLocalTracksAcquired = async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream()
      }

      let audioTrack = localStreamRef.current.getAudioTracks()[0]
      let videoTrack = localStreamRef.current.getVideoTracks()[0]

      // 1. Acquire and configure Audio Track if missing
      if (!audioTrack) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          audioTrack = audioStream.getAudioTracks()[0]
          audioTrack.enabled = audioEnabled
          localStreamRef.current.addTrack(audioTrack)
        } catch (audioErr) {
          console.warn("Could not acquire microphone track for pre-negotiation:", audioErr)
        }
      } else {
        audioTrack.enabled = audioEnabled
      }

      // 2. Acquire and configure Video Track if missing
      if (!videoTrack) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
          let rawVideoTrack = videoStream.getVideoTracks()[0]
          
          if (enableSignTranslation) {
            videoTrack = setupSignTranslationPipeline(rawVideoTrack)
          } else {
            videoTrack = rawVideoTrack
          }
          
          videoTrack.enabled = videoEnabled
          localStreamRef.current.addTrack(videoTrack)
        } catch (videoErr) {
          console.warn("Could not acquire camera track for pre-negotiation:", videoErr)
        }
      } else {
        videoTrack.enabled = videoEnabled
      }

      const updatedStream = new MediaStream(localStreamRef.current.getTracks())
      localStreamRef.current = updatedStream
      setLocalStream(updatedStream)

      if (localVideoRef.current) {
        if (enableSignTranslation && rawCameraStreamRef.current) {
          localVideoRef.current.srcObject = rawCameraStreamRef.current
        } else {
          localVideoRef.current.srcObject = updatedStream
        }
      }
    } catch (err) {
      console.error("Critical error in ensureLocalTracksAcquired:", err)
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
          if (enableSignTranslation && rawCameraStreamRef.current) {
            localVideoRef.current.srcObject = rawCameraStreamRef.current
          } else {
            localVideoRef.current.srcObject = newStream
          }
        }

        // Update track on all active peer connections
        peerConnectionsRef.current.forEach(async (pc, socketId) => {
          try {
            // Only replace track if we are NOT currently screensharing
            if (!screenStreamRef.current) {
              const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video')
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
            const videoTransceiver = pc.getTransceivers().find(t => t.receiver.track.kind === 'video')
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

    // Simply toggle the enabled property of the existing track
    let audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = nextState
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

  // Manage call preview lifecycle based on route visibility and call state
  useEffect(() => {
    if (isCallRoute) {
      // User is on the video-call page
      if (urlRoomId && urlRoomId !== roomId && !inCall) {
        setRoomId(urlRoomId)
      }
      // Start local stream preview for the lobby if not in a call and no stream exists yet
      if (!inCall && !localStreamRef.current) {
        startLocalStream()
      }
    } else {
      // User has navigated away
      if (!inCall) {
        // Not in a call: stop the lobby preview stream so camera is released
        cleanupCall()
      }
    }
  }, [isCallRoute, urlRoomId, inCall])

  // Cleanup on final component unmount
  useEffect(() => {
    return () => {
      cleanupCall()
    }
  }, [])

  // Sync media streams to video elements whenever they are mounted or updated
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Web Speech API Transcription Loop
  useEffect(() => {
    let active = true
    let restartTimer = null
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    const startRecognition = () => {
      if (!active || !inCall || !audioEnabled || !SpeechRecognition) return

      console.log("Speech recognition: Starting transcription loop with fresh instance.")
      
      // Stop and clean up any existing instance first
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {}
        recognitionRef.current = null
      }

      try {
        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = false
        rec.lang = 'en-US'
        
        rec.onresult = (event) => {
          if (!active) return
          const lastResultIndex = event.results.length - 1
          const text = event.results[lastResultIndex][0].transcript.trim()
          
          if (text && socketRef.current) {
            socketRef.current.emit("classroom-transcript", {
              roomId,
              text,
              name: user?.fullName || 'User'
            })
            
            // Add statement to local transcripts state
            setTranscripts(prev => [
              ...prev,
              {
                name: 'You',
                text,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ])
          }
        }
        
        rec.onerror = (e) => {
          console.error("Speech recognition error:", e.error, e)
          if (e.error === 'not-allowed') {
            console.warn("Speech recognition permission denied. Disabling auto-restart.")
            active = false
          }
        }
        
        rec.onend = () => {
          if (active && inCall && audioEnabled) {
            // Add a safety delay before restarting to prevent collisions with device release
            restartTimer = setTimeout(() => {
              startRecognition()
            }, 400)
          }
        }
        
        recognitionRef.current = rec
        rec.start()
      } catch (err) {
        console.error("Error starting SpeechRecognition:", err)
        if (active && inCall && audioEnabled) {
          restartTimer = setTimeout(() => {
            startRecognition()
          }, 2000) // Retry starting after 2 seconds
        }
      }
    }

    if (inCall && audioEnabled && SpeechRecognition) {
      startRecognition()
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err) {}
        recognitionRef.current = null
      }
    }
    
    return () => {
      active = false
      if (restartTimer) clearTimeout(restartTimer)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (err) {}
        recognitionRef.current = null
      }
    }
  }, [inCall, audioEnabled, roomId])

  // Clean up all streams and socket connections
  const cleanupCall = () => {
    cleanupSignTranslation()

    // Close AudioContext if active
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch (err) {
        console.error("Error closing AudioContext on cleanup:", err)
      }
      audioContextRef.current = null
    }
    
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
    setScreenShareRequestStatus('idle')
    setInCall(false)
    setCallStatus('idle')
    setMessages([])
    setTranscripts([])
    setAiSummary("")
    setIsTranscriptOpen(false)
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

    // Always pre-negotiate both audio and video transceivers to prevent mute/unmute and camera toggle failures
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    const videoTrack = (screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0)
      ? screenStreamRef.current.getVideoTracks()[0]
      : localStreamRef.current?.getVideoTracks()[0]

    if (isInitiator) {
      try {
        pc.addTransceiver(audioTrack || 'audio', {
          direction: 'sendrecv',
          streams: [localStreamRef.current].filter(Boolean)
        })
      } catch (e) {
        console.error("Error adding audio transceiver:", e)
      }

      try {
        pc.addTransceiver(videoTrack || 'video', {
          direction: 'sendrecv',
          streams: [localStreamRef.current].filter(Boolean)
        })
      } catch (e) {
        console.error("Error adding video transceiver:", e)
      }
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

  // Initialize Whiteboard Canvas State
  useEffect(() => {
    if (inCall && whiteboardCanvasRef.current) {
      const canvas = whiteboardCanvasRef.current
      if (!canvas.dataset.initialized) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          canvas.width = 800
          canvas.height = 500
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          canvas.dataset.initialized = "true"
        }
      }
    }
  }, [inCall, showWhiteboard])

  const getMousePos = (e) => {
    const canvas = whiteboardCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    
    // Support mobile touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    // Scale coordinates to fit the 800x500 local canvas resolution
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    }
  }

  const handleCanvasMouseDown = (e) => {
    const coords = getMousePos(e)
    isDrawingRef.current = true
    lastDrawingCoordsRef.current = coords
  }

  const handleCanvasMouseMove = (e) => {
    if (!isDrawingRef.current || !whiteboardCanvasRef.current) return
    
    // Prevent touch scrolling on mobile devices while drawing
    if (e.cancelable) e.preventDefault()
    
    const coords = getMousePos(e)
    const canvas = whiteboardCanvasRef.current
    const ctx = canvas.getContext("2d")
    
    if (ctx) {
      const color = isEraser ? '#0f172a' : brushColor
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(lastDrawingCoordsRef.current.x, lastDrawingCoordsRef.current.y)
      ctx.lineTo(coords.x, coords.y)
      ctx.stroke()
      
      if (socketRef.current) {
        socketRef.current.emit("whiteboard-draw", {
          roomId,
          prevX: lastDrawingCoordsRef.current.x,
          prevY: lastDrawingCoordsRef.current.y,
          x: coords.x,
          y: coords.y,
          color,
          size: brushSize
        })
      }
      
      lastDrawingCoordsRef.current = coords
    }
  }

  const handleCanvasMouseUp = () => {
    isDrawingRef.current = false
  }

  const handleClearWhiteboard = () => {
    if (!isTeacher) return
    const canvas = whiteboardCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-clear", { roomId })
    }
  }

  // Exports classroom notepad notes to a beautifully styled PDF
  const exportNotesPDF = () => {
    if (!notes.trim()) {
      toast.error("Notepad is empty. Write some notes first!")
      return
    }

    const toastId = toast.loading("Generating PDF...")
    try {
      const element = document.createElement('div')
      element.innerHTML = `
        <div style="font-family: 'Georgia', 'Times New Roman', serif; padding: 40px; background: #fffbeb; color: #1e293b; border: 3px double #b45309; min-height: 800px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 30px;">
              <div>
                <h1 style="font-size: 22px; color: #78350f; font-weight: bold; margin: 0; letter-spacing: 0.05em;">CLASSROOM STUDY NOTES</h1>
                <p style="font-size: 10px; color: #92400e; margin: 4px 0 0 0; font-family: monospace; text-transform: uppercase; letter-spacing: 0.1em;">GESTRO Video Classroom</p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 11px; color: #78350f; font-weight: bold; margin: 0;">DATE: ${new Date().toLocaleDateString()}</p>
                <p style="font-size: 9px; color: #92400e; margin: 2px 0 0 0; font-family: monospace;">ROOM ID: ${roomId}</p>
              </div>
            </div>
            
            <div style="font-size: 13px; line-height: 1.7; white-space: pre-wrap; color: #334155; padding: 0 10px;">
              ${notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; margin-top: 40px; font-family: monospace; letter-spacing: 0.05em;">
            &bull; DOWNLOADED FROM GESTRO VIDEO CLASSROOM &bull; KEEP FOCUSING &bull;
          </div>
        </div>
      `
      
      const options = {
        margin: 10,
        filename: `Classroom-Notes-${roomId}-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      html2pdf().from(element).set(options).save().then(() => {
        toast.dismiss(toastId)
        toast.success("PDF downloaded successfully!")
      }).catch(err => {
        toast.dismiss(toastId)
        console.error("PDF generation failed:", err)
        toast.error("Failed to generate PDF.")
      })
    } catch (error) {
      toast.dismiss(toastId)
      console.error("PDF generation error:", error)
      toast.error("Failed to generate PDF.")
    }
  }

  const { getToken } = useAuth()

  const handleGenerateClassSummary = async () => {
    if (transcripts.length === 0) {
      toast.error("Transcript is empty. Please speak in the call first.")
      return
    }

    setIsSummarizing(true)
    setAiSummary("")
    const toastId = toast.loading("AI is generating lecture summary & notes...")

    try {
      const formattedTranscript = transcripts
        .map(t => `[${t.time}] ${t.name}: ${t.text}`)
        .join("\n")

      const token = await getToken()
      
      const { data } = await axios.post('/api/ai/summarize-class', {
        transcript: formattedTranscript
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (data.success && data.content) {
        setAiSummary(data.content)
        toast.dismiss(toastId)
        toast.success("Summary generated successfully!")
      } else {
        toast.dismiss(toastId)
        toast.error(data.message || "Failed to generate class summary.")
      }
    } catch (err) {
      toast.dismiss(toastId)
      console.error("AI summarization failed:", err)
      toast.error("An error occurred during AI summarization.")
    } finally {
      setIsSummarizing(false)
    }
  }

  const exportSummaryPDF = () => {
    if (!aiSummary) return
    const toastId = toast.loading("Generating PDF...")

    try {
      const element = document.createElement('div')
      element.innerHTML = `
        <div style="padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background-color: #ffffff; min-height: 297mm; box-sizing: border-box; line-height: 1.6;">
          <div style="border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h1 style="color: #4f46e5; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase;">Gestro AI Class Summary</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Classroom Study Guide & Summary Notes</p>
            </div>
            <div style="text-align: right;">
              <span style="background-color: #f1f5f9; color: #475569; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; border: 1px solid #e2e8f0; font-family: monospace;">ROOM: ${roomId}</span>
              <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 10px; font-weight: 500;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
          
          <div style="font-size: 13px; color: #334155; margin-bottom: 30px; line-height: 1.8;">
            ${aiSummary.split('\n').map(line => {
              const clean = line.trim()
              if (clean.startsWith('# ')) {
                return `<h1 style="color: #1e1b4b; font-size: 20px; font-weight: 800; margin-top: 25px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">${clean.replace('# ', '')}</h1>`
              } else if (clean.startsWith('## ')) {
                return `<h2 style="color: #312e81; font-size: 16px; font-weight: 700; margin-top: 20px; margin-bottom: 10px;">${clean.replace('## ', '')}</h2>`
              } else if (clean.startsWith('### ')) {
                return `<h3 style="color: #4338ca; font-size: 14px; font-weight: 700; margin-top: 15px; margin-bottom: 8px;">${clean.replace('### ', '')}</h3>`
              } else if (clean.startsWith('- ') || clean.startsWith('* ')) {
                return `<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: square; color: #475569;">${clean.replace(/^[-*]\s+/, '')}</li>`
              } else if (clean.match(/^\d+\.\s+/)) {
                return `<li style="margin-left: 20px; margin-bottom: 6px; list-style-type: decimal; color: #475569;">${clean.replace(/^\d+\.\s+/, '')}</li>`
              } else if (clean === '') {
                return '<div style="height: 10px;"></div>'
              } else {
                return `<p style="margin: 0 0 10px 0; color: #334155;">${clean}</p>`
              }
            }).join('')}
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; margin-top: 40px; font-family: monospace; letter-spacing: 0.05em;">
            &bull; GENERATED VIA GESTRO AI STUDY ENGINE &bull;
          </div>
        </div>
      `

      const options = {
        margin: 10,
        filename: `Gestro-AI-Class-Summary-${roomId}-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      html2pdf().from(element).set(options).save().then(() => {
        toast.dismiss(toastId)
        toast.success("Class Notes PDF downloaded successfully!")
      }).catch(err => {
        toast.dismiss(toastId)
        console.error("PDF generation failed:", err)
        toast.error("Failed to generate PDF.")
      })
    } catch (error) {
      toast.dismiss(toastId)
      console.error("PDF generation error:", error)
      toast.error("An error occurred during PDF generation.")
    }
  }

  // Join video call room
  const joinCall = async (e) => {
    if (e) e.preventDefault()
    if (!roomId.trim()) {
      toast.error("Please enter a valid Room ID")
      return
    }

    // Ensure we have local stream active and fully configured with both channels
    await ensureLocalTracksAcquired()

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

    socket.on("classroom-transcript", ({ name, text }) => {
      setTranscripts(prev => [
        ...prev,
        {
          name,
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    })

    socket.on("screen-share-request", ({ studentId, name }) => {
      if (isTeacher) {
        toast((t) => (
          <div className="flex flex-col gap-2 p-1 text-left">
            <p className="text-sm font-semibold text-slate-100">
              <span className="text-purple-400 font-bold">{name}</span> wants to share their screen.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  socket.emit("approve-screen-share", { studentId, roomId: activeRoomIdRef.current })
                  toast.dismiss(t.id)
                }}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  socket.emit("deny-screen-share", { studentId, roomId: activeRoomIdRef.current })
                  toast.dismiss(t.id)
                }}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Deny
              </button>
            </div>
          </div>
        ), {
          duration: 10000,
          style: {
            background: '#0f172a',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            color: '#fff',
            padding: '12px'
          }
        })
      }
    })

    socket.on("screen-share-approved", () => {
      toast.success("Teacher approved your screen share request!")
      setScreenShareRequestStatus('approved')
      setTimeout(() => {
        toggleScreenShare()
      }, 300)
    })

    socket.on("screen-share-denied", () => {
      toast.error("Your screen share request was denied by the teacher.")
      setScreenShareRequestStatus('idle')
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
      
      // Request whiteboard state from existing users
      socket.emit("request-whiteboard-state", { roomId, targetId: socket.id })
      
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

    // Collaborative Whiteboard listeners
    socket.on("whiteboard-draw", ({ prevX, prevY, x, y, color, size }) => {
      const canvas = whiteboardCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          if (!canvas.dataset.initialized) {
            canvas.width = 800
            canvas.height = 500
            ctx.fillStyle = '#0f172a'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            canvas.dataset.initialized = "true"
          }
          ctx.beginPath()
          ctx.strokeStyle = color
          ctx.lineWidth = size
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.moveTo(prevX, prevY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
      }
    })

    socket.on("whiteboard-clear", () => {
      const canvas = whiteboardCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          if (!canvas.dataset.initialized) {
            canvas.width = 800
            canvas.height = 500
            canvas.dataset.initialized = "true"
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
    })

    socket.on("request-whiteboard-state", ({ targetId }) => {
      const canvas = whiteboardCanvasRef.current
      if (canvas && socketRef.current) {
        const dataUrl = canvas.toDataURL()
        socketRef.current.emit("send-whiteboard-state", { targetId, dataUrl })
      }
    })

    socket.on("whiteboard-state", ({ dataUrl }) => {
      const canvas = whiteboardCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          if (!canvas.dataset.initialized) {
            canvas.width = 800
            canvas.height = 500
            ctx.fillStyle = '#0f172a'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            canvas.dataset.initialized = "true"
          }
          const img = new Image()
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
          }
          img.src = dataUrl
        }
      }
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
      setScreenShareRequestStatus('idle')

      // Close AudioContext if active
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close()
        } catch (err) {
          console.error("Error closing AudioContext on screen share stop:", err)
        }
        audioContextRef.current = null
      }

      // Revert track on all peer connections to mic track
      const micTrack = localStreamRef.current?.getAudioTracks()[0]
      if (micTrack) {
        peerConnectionsRef.current.forEach(pc => {
          const senders = pc.getSenders()
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio')
          if (audioSender) {
            audioSender.replaceTrack(micTrack).catch(err => {
              console.error("Error reverting audio track back to microphone:", err)
            })
          }
        })
      }
      
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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]
        const screenAudioTrack = screenStream.getAudioTracks()[0]

        setIsScreenSharing(true)

        // Web Audio Context mixing for screen audio + mic audio
        let activeAudioTrack = null
        const micTrack = localStreamRef.current?.getAudioTracks()[0]

        if (screenAudioTrack) {
          if (micTrack) {
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
              audioContextRef.current = audioCtx
              
              const mixedDest = audioCtx.createMediaStreamAudioDestination()
              
              // Connect microphone source
              const micStream = new MediaStream([micTrack])
              const micSource = audioCtx.createMediaStreamSource(micStream)
              micSource.connect(mixedDest)
              
              // Connect screen audio source
              const screenAudioStream = new MediaStream([screenAudioTrack])
              const screenSource = audioCtx.createMediaStreamSource(screenAudioStream)
              screenSource.connect(mixedDest)
              
              if (audioCtx.state === 'suspended') {
                await audioCtx.resume()
              }
              
              activeAudioTrack = mixedDest.stream.getAudioTracks()[0]
            } catch (err) {
              console.error("Failed to initialize Web Audio mixing, falling back to screen audio only:", err)
              activeAudioTrack = screenAudioTrack
            }
          } else {
            activeAudioTrack = screenAudioTrack
          }
        }

        // Replace active audio sender tracks on all peer connections
        if (activeAudioTrack) {
          peerConnectionsRef.current.forEach(pc => {
            const senders = pc.getSenders()
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio')
            if (audioSender) {
              audioSender.replaceTrack(activeAudioTrack).catch(err => {
                console.error("Error replacing audio track with screen audio/mix:", err)
              })
            }
          })
        }

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
          setScreenShareRequestStatus('idle')

          // Close AudioContext if active
          if (audioContextRef.current) {
            try {
              audioContextRef.current.close()
            } catch (err) {
              console.error("Error closing AudioContext on screen share stop:", err)
            }
            audioContextRef.current = null
          }

          // Revert track back to microphone
          const micTrack = localStreamRef.current?.getAudioTracks()[0]
          if (micTrack) {
            peerConnectionsRef.current.forEach(pc => {
              const senders = pc.getSenders()
              const audioSender = senders.find(s => s.track && s.track.kind === 'audio')
              if (audioSender) {
                audioSender.replaceTrack(micTrack).catch(err => {
                  console.error("Error reverting audio track back to microphone:", err)
                })
              }
            })
          }

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

  const handleScreenShareClick = () => {
    if (isTeacher) {
      toggleScreenShare()
      return
    }

    // Student role request screen share flow
    if (isScreenSharing) {
      toggleScreenShare()
    } else {
      if (screenShareRequestStatus === 'approved') {
        toggleScreenShare()
      } else if (screenShareRequestStatus === 'requested') {
        toast.loading("Waiting for teacher's approval...", { id: 'screen-share-pending', duration: 2000 })
      } else {
        setScreenShareRequestStatus('requested')
        toast.success("Screen share request sent to the teacher.")
        if (socketRef.current) {
          socketRef.current.emit("request-screen-share", { 
            roomId, 
            name: user?.fullName || 'Student' 
          })
        }
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

  if (!isCallRoute) {
    if (!inCall) return null

    // We are active in a call, but navigated away. Render premium floating widget.
    const activePeer = peers[0]
    
    return (
      <>
        {/* Hidden elements for Canvas streaming (MUST NOT use display:none or browser throttles to 1fps) */}
        <video ref={rawVideoRef} className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" autoPlay playsInline muted />
        <canvas ref={translationCanvasRef} width="320" height="240" className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" />
        
        <div 
          className="fixed bottom-6 right-6 z-50 w-[280px] bg-slate-900/95 border border-purple-500/30 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col gap-2 p-3 text-white transition-all duration-300"
          style={{ boxShadow: '0 10px 30px -5px rgba(139, 92, 246, 0.25), 0 0 15px rgba(139, 92, 246, 0.1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-purple-300">
                Gestro Call Active
              </span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
              Room: {roomId}
            </span>
          </div>

          {/* Small Video Box */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40">
            {activePeer ? (
              <VideoCard
                key={activePeer.socketId}
                stream={activePeer.stream}
                screenStream={null}
                isScreenSharing={activePeer.isScreenSharing || false}
                isLocal={false}
                signTranslationText={activePeer.signTranslationText}
                userObj={activePeer.user}
                isVideoEnabled={activePeer.videoEnabled !== false}
                isAudioEnabled={activePeer.audioEnabled !== false}
                activeVideoMid={activePeer.activeVideoMid}
                minHeightClass="min-h-0"
              />
            ) : (
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
                minHeightClass="min-h-0"
              />
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center justify-between gap-2 px-1 mt-1">
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleAudio}
                className={`p-2 rounded-lg transition-all duration-200 cursor-pointer border ${audioEnabled ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400'}`}
                title={audioEnabled ? "Mute Mic" : "Unmute Mic"}
              >
                {audioEnabled ? <Mic className='w-4 h-4' /> : <MicOff className='w-4 h-4' />}
              </button>
              <button 
                onClick={toggleVideo}
                className={`p-2 rounded-lg transition-all duration-200 cursor-pointer border ${videoEnabled ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-red-500/20 border-red-500/30 hover:bg-red-500/30 text-red-400'}`}
                title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}
              >
                {videoEnabled ? <Video className='w-4 h-4' /> : <VideoOff className='w-4 h-4' />}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/ai/video-call?room=${roomId}`)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(147,51,234,0.3)] cursor-pointer"
                title="Return to full classroom"
              >
                <Sparkles className="w-3 h-3" /> Return
              </button>
              <button 
                onClick={leaveCall}
                className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all cursor-pointer shadow-md"
                title="Disconnect Call"
              >
                <PhoneOff className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Hidden elements for Canvas streaming (MUST NOT use display:none or browser throttles to 1fps) */}
      <video ref={rawVideoRef} className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" autoPlay playsInline muted />
      <canvas ref={translationCanvasRef} width="320" height="240" className="fixed top-0 left-0 opacity-0 pointer-events-none -z-50" />
          <motion.div 
            initial={{opacity:0}} 
            animate={{opacity:1}} 
            className='absolute inset-0 z-10 w-full h-full flex flex-col md:flex-row overflow-hidden text-white bg-[#020617]'
          >
        
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
            <div className='flex-1 w-full relative flex flex-col lg:flex-row items-stretch justify-center p-4 min-h-0 overflow-hidden gap-6'>
              
              {/* Floating Local Video Card when 2+ people in call and whiteboard is closed */}
              {peers.length >= 1 && !showWhiteboard && (
                <div className="absolute top-6 right-6 z-30 w-40 md:w-56 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-slate-950 transition-all duration-300 hover:scale-105 hover:border-purple-400">
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
                    minHeightClass="min-h-0"
                  />
                </div>
              )}

              <div className={`bg-slate-900 border border-white/10 rounded-3xl p-4 flex-col shadow-2xl relative select-none ${showWhiteboard ? 'flex-[2] flex' : 'hidden'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Hash className="w-5 text-purple-400 animate-pulse" /> Shared Classroom Board
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowWhiteboard(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Canvas Container */}
                <div className="flex-1 bg-slate-950 rounded-2xl overflow-hidden relative border border-white/5 aspect-video max-h-[480px]">
                  <canvas
                    ref={whiteboardCanvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onTouchStart={handleCanvasMouseDown}
                    onTouchMove={handleCanvasMouseMove}
                    onTouchEnd={handleCanvasMouseUp}
                    className="w-full h-full cursor-crosshair bg-[#0f172a]"
                  />
                </div>
                
                {/* Whiteboard Controls */}
                <div className="mt-4 p-3 bg-white/5 border border-white/15 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                  {/* Brush Colors */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400 font-semibold mr-1">Colors:</span>
                    {[
                      { hex: '#ffffff', label: 'White' },
                      { hex: '#10B981', label: 'Emerald' },
                      { hex: '#06B6D4', label: 'Cyan' },
                      { hex: '#A855F7', label: 'Purple' },
                      { hex: '#F59E0B', label: 'Yellow' },
                      { hex: '#EF4444', label: 'Red' },
                    ].map((colorObj) => (
                      <button
                        key={colorObj.hex}
                        type="button"
                        onClick={() => { setBrushColor(colorObj.hex); setIsEraser(false); }}
                        style={{ backgroundColor: colorObj.hex }}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${brushColor === colorObj.hex && !isEraser ? 'scale-125 ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'}`}
                        title={colorObj.label}
                      />
                    ))}
                    
                    {/* Color Picker */}
                    <input 
                      type="color"
                      value={brushColor}
                      onChange={(e) => { setBrushColor(e.target.value); setIsEraser(false); }}
                      className="w-7 h-7 rounded-lg border-0 bg-transparent cursor-pointer"
                      title="Custom Color"
                    />
                  </div>
                  
                  {/* Brush Size */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-400 font-semibold">Size:</span>
                    <input 
                      type="range"
                      min="2"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-24 accent-purple-500 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                    />
                    <span className="text-xs text-slate-300 font-mono">{brushSize}px</span>
                  </div>
                  
                  {/* Eraser and Clear controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEraser(!isEraser)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isEraser 
                          ? 'bg-purple-600 border-purple-500 text-white shadow-md' 
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5" /> Eraser
                    </button>
                    
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={handleClearWhiteboard}
                        className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        Clear Board
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Video Grid / Panel */}
              <div className={showWhiteboard ? 'flex-1 max-w-[360px] flex flex-col gap-4 overflow-y-auto pr-2' : 'flex-1 w-full relative flex items-start lg:items-center justify-center p-4 min-h-0 overflow-y-auto'}>
                <div className={showWhiteboard ? 'w-full flex flex-col gap-4' : `grid grid-cols-1 ${
                  peers.length === 0 ? 'md:grid-cols-1 max-w-xl' : 
                  peers.length === 1 ? 'md:grid-cols-1 max-w-3xl' : 
                  'md:grid-cols-2 max-w-5xl'
                } gap-6 mx-auto w-full items-center justify-items-center`}>
                  
                  {/* Render Local Video Card:
                      1. In grid when no peers are present (peers.length === 0)
                      2. In sidebar list as a smaller card when whiteboard is open */}
                  {(peers.length === 0 || showWhiteboard) && (
                    <div className={showWhiteboard ? 'w-36 md:w-48 self-end shadow-lg rounded-xl overflow-hidden border border-white/10 bg-slate-950' : 'w-full'}>
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
                        minHeightClass={showWhiteboard ? 'min-h-0' : 'min-h-[180px]'}
                      />
                    </div>
                  )}

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
                          type="button"
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

                {/* Screen Share toggle - Visible to Teachers & Students */}
                <button
                  onClick={handleScreenShareClick}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer relative ${
                    isScreenSharing 
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]' 
                      : screenShareRequestStatus === 'requested'
                      ? 'bg-amber-600 animate-pulse text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={
                    isScreenSharing 
                      ? "Stop Screen Sharing" 
                      : screenShareRequestStatus === 'requested'
                      ? "Pending Approval..." 
                      : "Share Screen"
                  }
                >
                  {isScreenSharing ? <MonitorOff className='w-5' /> : <Monitor className='w-5' />}
                  {screenShareRequestStatus === 'requested' && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                  )}
                </button>

                {/* Open Chat toggle */}
                <button
                  onClick={() => { setIsChatOpen(prev => !prev); setIsNotesOpen(false); setIsTranscriptOpen(false); }}
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

                {/* Quick Notes toggle */}
                <button
                  onClick={() => { setIsNotesOpen(prev => !prev); setIsChatOpen(false); setIsTranscriptOpen(false); }}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer relative ${isNotesOpen ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title="Quick Notes"
                >
                  <BookOpen className='w-5' />
                </button>

                {/* AI Notes Summary toggle */}
                <button
                  onClick={() => { setIsTranscriptOpen(prev => !prev); setIsChatOpen(false); setIsNotesOpen(false); }}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer relative ${isTranscriptOpen ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title="AI Class Summary"
                >
                  <Sparkles className='w-5' />
                </button>

                {/* Whiteboard toggle */}
                <button
                  onClick={() => setShowWhiteboard(prev => !prev)}
                  className={`p-3.5 rounded-full transition-all duration-200 cursor-pointer relative ${showWhiteboard ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                  title="Toggle Whiteboard"
                >
                  <Palette className='w-5' />
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

      {/* RIGHT: Sliding Notepad Drawer */}
      {inCall && isNotesOpen && (
        <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className='absolute bottom-0 left-0 right-0 z-50 md:static md:z-auto w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-[70vh] md:h-full shadow-2xl transition-all duration-300'>
          
          {/* Notes Header */}
          <div className='p-4 border-b border-white/10 flex justify-between items-center bg-black/40'>
            <div className='flex items-center gap-2'>
              <BookOpen className='w-4 text-amber-400 drop-shadow-sm' />
              <h3 className='font-semibold text-sm text-white'>Quick Notes</h3>
            </div>
            <button 
              onClick={() => setIsNotesOpen(false)}
              className='text-slate-400 hover:text-white cursor-pointer transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Notepad Textarea */}
          <div className='flex-1 flex flex-col p-4 gap-3 overflow-y-auto bg-transparent'>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jot down notes or study points during this session..."
              className="w-full flex-1 bg-amber-50/95 border border-amber-200 text-slate-800 placeholder-slate-400 p-3.5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-amber-500 font-serif text-sm resize-none shadow-inner leading-relaxed min-h-[200px]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
              <span>Style: Cozy Serif</span>
              <span>{notes.length} characters</span>
            </div>
          </div>

          {/* Notes Controls */}
          <div className='p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2'>
            <button
              onClick={exportNotesPDF}
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer text-center"
            >
              Download Notes (PDF)
            </button>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear your classroom notes?")) {
                  setNotes('')
                  toast.error("Notes cleared")
                }
              }}
              className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-500/30 hover:text-red-400 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center"
            >
              Clear Note
            </button>
          </div>

        </motion.div>
      )}

      {/* RIGHT: Sliding Transcription / AI Notes Drawer */}
      {inCall && isTranscriptOpen && (
        <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className='absolute bottom-0 left-0 right-0 z-50 md:static md:z-auto w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-[70vh] md:h-full shadow-2xl transition-all duration-300'>
          
          {/* Transcript Header */}
          <div className='p-4 border-b border-white/10 flex justify-between items-center bg-black/40'>
            <div className='flex items-center gap-2'>
              <Sparkles className='w-4 text-purple-400 drop-shadow-sm animate-pulse' />
              <h3 className='font-semibold text-sm text-white'>AI Classroom Feed</h3>
            </div>
            <button 
              onClick={() => setIsTranscriptOpen(false)}
              className='text-slate-400 hover:text-white cursor-pointer transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Transcript List or AI Summary Display */}
          <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-transparent'>
            {aiSummary ? (
              // Display AI summary
              <div className="text-white text-xs leading-relaxed space-y-3 prose prose-invert select-text bg-white/5 p-3.5 rounded-2xl border border-white/5 text-left">
                <h4 className="text-purple-400 font-bold border-b border-white/10 pb-1.5 flex items-center justify-between">
                  <span>Class AI Summary</span>
                  <button 
                    onClick={() => setAiSummary("")}
                    className="text-[10px] text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    View Logs
                  </button>
                </h4>
                <div className="whitespace-pre-wrap font-sans overflow-x-auto text-[11px] leading-relaxed">
                  {aiSummary}
                </div>
              </div>
            ) : (
              // Display live transcripts
              transcripts.length === 0 ? (
                <div className='h-full flex flex-col items-center justify-center text-center text-slate-400 p-4 gap-2'>
                  <Sparkles className='w-8 h-8 opacity-40 animate-pulse text-purple-400' />
                  <p className='text-xs'>Unmute and start speaking. AI will transcribe class conversation here in real-time!</p>
                </div>
              ) : (
                transcripts.map((t, index) => (
                  <div key={index} className="flex flex-col text-xs leading-relaxed bg-white/5 border border-white/5 p-2.5 rounded-xl text-left">
                    <div className="flex justify-between text-[10px] text-purple-400 font-semibold mb-1">
                      <span>{t.name}</span>
                      <span className="text-slate-500 font-normal">{t.time}</span>
                    </div>
                    <p className="text-slate-200">{t.text}</p>
                  </div>
                ))
              )
            )}
          </div>

          {/* Controls */}
          <div className='p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2'>
            {aiSummary ? (
              <>
                <button
                  onClick={exportSummaryPDF}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer text-center"
                >
                  Download Summary (PDF)
                </button>
                <button
                  onClick={() => setAiSummary("")}
                  className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center"
                >
                  Back to Transcript
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGenerateClassSummary}
                  disabled={isSummarizing || transcripts.length === 0}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-md text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSummarizing || transcripts.length === 0
                      ? 'bg-purple-800/40 text-slate-500 cursor-not-allowed border border-white/5'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {isSummarizing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Generating Summary...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Summarize Class (AI)
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("Clear all transcription logs?")) {
                      setTranscripts([])
                      setAiSummary("")
                      toast.error("Transcript cleared")
                    }
                  }}
                  disabled={transcripts.length === 0}
                  className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-red-500/30 hover:text-red-400 text-slate-300 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Feed
                </button>
              </>
            )}
          </div>

        </motion.div>
      )}

      </motion.div>
    </>
  )
}

export default VideoCall
