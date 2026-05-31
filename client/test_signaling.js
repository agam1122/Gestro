import { io } from "socket.io-client"

const SOCKET_URL = "http://localhost:4000"
const ROOM_ID = "test-signaling-room"

console.log("Starting full WebRTC signaling handshake integration test...")

const clients = []

const createClient = (name) => {
  const socket = io(SOCKET_URL, {
    forceNew: true,
    transports: ["websocket"]
  })

  socket.on("connect", () => {
    console.log(`[${name}] Connected with socket ID: ${socket.id}`)
    socket.emit("join-room", {
      roomId: ROOM_ID,
      user: {
        fullName: name,
        imageUrl: "",
        videoEnabled: false,
        audioEnabled: false
      }
    })
  })

  socket.on("joined-room", ({ roomId, existingUsers }) => {
    console.log(`[${name}] Joined room ${roomId}. Existing users:`, existingUsers.map(eu => `${eu.user.fullName} (${eu.socketId})`))
    
    // Send an offer to each existing user (simulating the client)
    existingUsers.forEach(eu => {
      console.log(`[${name}] Initiating handshake: sending offer to ${eu.user.fullName} (${eu.socketId})`)
      socket.emit("webrtc-offer", {
        offer: { type: "offer", sdp: `sdp-from-${name}-to-${eu.user.fullName}` },
        targetId: eu.socketId,
        roomId: ROOM_ID,
        user: {
          fullName: name,
          imageUrl: "",
          videoEnabled: false,
          audioEnabled: false
        }
      })
    })
  })

  socket.on("user-joined", ({ socketId, user }) => {
    console.log(`[${name}] Received user-joined: ${user.fullName} (${socketId})`)
  })

  socket.on("webrtc-offer", ({ offer, senderId, user }) => {
    console.log(`[${name}] Received offer from: ${user.fullName} (${senderId}) with SDP: "${offer.sdp}"`)
    
    // Simulating sending an answer back
    console.log(`[${name}] Responding to ${user.fullName}: sending answer to ${senderId}`)
    socket.emit("webrtc-answer", {
      answer: { type: "answer", sdp: `sdp-answer-from-${name}-to-${user.fullName}` },
      targetId: senderId,
      roomId: ROOM_ID,
      user: {
        fullName: name,
        imageUrl: "",
        videoEnabled: false,
        audioEnabled: false
      }
    })
  })

  socket.on("webrtc-answer", ({ answer, senderId }) => {
    console.log(`[${name}] Received answer from: ${senderId} with SDP: "${answer.sdp}"`)
  })

  socket.on("ice-candidate", ({ candidate, senderId }) => {
    console.log(`[${name}] Received ICE candidate from: ${senderId}`)
  })

  socket.on("disconnect", () => {
    console.log(`[${name}] Disconnected`)
  })

  clients.push(socket)
}

// Connect Client 1
createClient("Client-1")

// Connect Client 2 after 1 second
setTimeout(() => {
  createClient("Client-2")
}, 1000)

// Connect Client 3 after 2 seconds
setTimeout(() => {
  createClient("Client-3")
}, 2000)

// Cleanup after 6 seconds
setTimeout(() => {
  console.log("Cleaning up clients...")
  clients.forEach(c => c.disconnect())
  process.exit(0)
}, 6000)
