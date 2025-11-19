import express from "express"
import cors from "cors"
import "dotenv/config"
import { clerkMiddleware, requireAuth } from '@clerk/express'
import aiRouter from "./routes/aiRoutes.js"
import connectCloudinary from "./configs/cloudinary.js"
import userRouter from "./routes/userRoutes.js"

const app = express()
const PORT = process.env.port || 4000

await connectCloudinary();

app.use(clerkMiddleware())

app.use(cors())
app.use(express.json()) 

app.get("/", (req, res) => res.send("Server is live!"))

// app.use(requireAuth)

app.use('/api/ai', aiRouter)
app.use('/api/user', userRouter)


app.listen(PORT, () => {
    console.log("Server is running on Port", PORT)
})
