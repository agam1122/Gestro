import express from 'express'

import { auth } from '../middlewares/auth.js'

import { generateQuestionPaper, resumeReview, summarizeClass, interviewChat, analyzeInterview } from '../controllers/aiController.js'

import upload from '../configs/multer.js'





const aiRouter = express.Router()



aiRouter.post('/generate-question-paper', auth, generateQuestionPaper)
aiRouter.post('/resume-review', upload.single('resume'), auth,  resumeReview)
aiRouter.post('/summarize-class', auth, summarizeClass)
aiRouter.post('/interview-chat', auth, interviewChat)
aiRouter.post('/analyze-interview', auth, analyzeInterview)


export default aiRouter