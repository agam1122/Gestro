import express from "express"
import cors from "cors"
import "dotenv/config"
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from "./routes/aiRoutes.js"
import connectCloudinary from "./configs/cloudinary.js"
import userRouter from "./routes/userRoutes.js"
import libraryRouter from "./routes/libraryRoutes.js"
import classroomRouter from "./routes/classroomRoutes.js"
import pageRouter from "./routes/pageRoutes.js"

import { Server } from "socket.io"
import http from "http"

const app = express()
const PORT = process.env.port || 4000

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

await connectCloudinary();

app.use(clerkMiddleware())

app.use(cors())
app.use(express.json()) 

app.get("/", (req, res) => res.send("Server is live!"))

// app.use(requireAuth)

app.use('/api/ai', aiRouter)
app.use('/api/user', userRouter)
app.use('/api/library', libraryRouter)
app.use('/api/classrooms', classroomRouter)
app.use('/api/pages', pageRouter)

// Socket.io WebRTC Signaling Logic
io.on("connection", (socket) => {
    console.log("User connected to socket:", socket.id)

    socket.on("join-room", ({ roomId, user }) => {
        const room = io.sockets.adapter.rooms.get(roomId)
        const numClients = room ? room.size : 0

        if (numClients === 0 && user?.role !== 'teacher') {
            socket.emit("error-message", { message: "Only teachers can start a new video call room." })
            return
        }

        if (numClients >= 3) {
            socket.emit("room-full", { roomId })
            return
        }

        const existingUsers = []
        if (room && numClients > 0) {
            Array.from(room).forEach(socketId => {
                const existingSocket = io.sockets.sockets.get(socketId)
                if (existingSocket && existingSocket.userData) {
                    existingUsers.push({
                        socketId: socketId,
                        user: existingSocket.userData
                    })
                }
            })
        }

        socket.userData = user
        socket.join(roomId)
        console.log(`User ${socket.id} (${user?.fullName || 'Anonymous'}) joined room: ${roomId}`)
        
        socket.emit("joined-room", { roomId, existingUsers })
        socket.to(roomId).emit("user-joined", { socketId: socket.id, user })
    })

    socket.on("webrtc-offer", ({ offer, targetId, user, ...rest }) => {
        io.to(targetId).emit("webrtc-offer", { offer, senderId: socket.id, user, ...rest })
    })

    socket.on("webrtc-answer", ({ answer, targetId, user, ...rest }) => {
        io.to(targetId).emit("webrtc-answer", { answer, senderId: socket.id, user, ...rest })
    })

    socket.on("ice-candidate", ({ candidate, targetId }) => {
        io.to(targetId).emit("ice-candidate", { candidate, senderId: socket.id })
    })

    socket.on("media-state-toggle", ({ type, enabled, roomId, ...rest }) => {
        if (socket.userData) {
            if (type === 'video') socket.userData.videoEnabled = enabled
            if (type === 'audio') socket.userData.audioEnabled = enabled
            if (type === 'screen') {
                socket.userData.isScreenSharing = enabled
                socket.userData.activeVideoMid = rest.mid || null
            }
        }
        socket.to(roomId).emit("media-state-toggle", {
            socketId: socket.id,
            type,
            enabled,
            ...rest
        })
    })

    socket.on("chat-message", ({ message, roomId, user }) => {
        socket.to(roomId).emit("chat-message", {
            message,
            senderId: socket.id,
            user,
            timestamp: new Date().toISOString()
        })
    })

    socket.on("sign-translation", ({ text, roomId }) => {
        socket.to(roomId).emit("sign-translation", {
            text,
            senderId: socket.id
        })
    })

    socket.on("leave-room", ({ roomId }) => {
        socket.leave(roomId)
        console.log(`User ${socket.id} left room: ${roomId}`)
        socket.to(roomId).emit("user-left", { socketId: socket.id })
    })

    socket.on("disconnecting", () => {
        console.log("User disconnecting:", socket.id)
        socket.rooms.forEach((roomId) => {
            if (roomId !== socket.id) {
                socket.to(roomId).emit("user-left", { socketId: socket.id })
            }
        })
    })
})

server.listen(PORT, () => {
    console.log("Server is running on Port", PORT)
})
