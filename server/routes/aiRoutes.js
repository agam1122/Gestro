import express from 'express'

import { auth } from '../middlewares/auth.js'

import { generateQuestionPaper, resumeReview } from '../controllers/aiController.js'

import upload from '../configs/multer.js'





const aiRouter = express.Router()



aiRouter.post('/generate-question-paper', auth, generateQuestionPaper)
aiRouter.post('/resume-review', upload.single('resume'), auth,  resumeReview)


export default aiRouter