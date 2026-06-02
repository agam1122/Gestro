import { GoogleGenAI } from "@google/genai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import {v2 as cloudinary} from 'cloudinary';
import FormData from "form-data";
import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";



const AI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MAX_OUTPUT_TOKENS_BUFFER = 1500; 
const FREE_USAGE_LIMIT = 1000;



//Question Paper generation function (formerly Article)
export const generateQuestionPaper = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const { universityName, branch, semester, subject, syllabus, totalMarks, mcqCount, shortCount, longCount } = req.body;
    
    // Check if user is a teacher
    const user = await clerkClient.users.getUser(userId);
    if (user.publicMetadata?.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: "Only teachers can generate question papers.",
      });
    }
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    const free_usage = req.free_usage; 
    
    // Fixed max tokens for question papers
    const safeMaxTokens = 4000; 

    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" && free_usage >= FREE_USAGE_LIMIT) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    // Build the structural instructions dynamically
    let instructionString = `You MUST generate EXACTLY the following quantities of questions, organized into sections. Do not skip any:\n`;
    if (mcqCount > 0) instructionString += `- Section A: Exactly ${mcqCount} Multiple Choice Questions (MCQs).\n`;
    if (shortCount > 0) instructionString += `- Section B: Exactly ${shortCount} Short Answer Questions.\n`;
    if (longCount > 0) instructionString += `- Section C: Exactly ${longCount} Theoretical Long Answer Questions.\n`;

    let answerKeyInstruction = "";
    if (mcqCount > 0) {
      answerKeyInstruction = `6. ANSWER KEY SEPARATION: You MUST append the exact string "====ANSWER_KEY====" at the very end of your response, and then write the answer key for the MCQs underneath it. Do not include answers for short/long questions.`;
    } else {
      answerKeyInstruction = `6. DO NOT put an Answer Key in the main question paper section.`;
    }

    // CORE LOGIC: Generate a question paper.
    const response = await AI.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [{ role: "user", parts: [{ text: `Generate a professional engineering college question paper for ${universityName ? universityName + ', ' : ''}Branch: ${branch}, ${semester}, Subject: ${subject}. 
      
Syllabus to cover:
${syllabus}

${instructionString}

CRITICAL MARKDOWN FORMATTING INSTRUCTIONS:
1. Heading: Start immediately with the University/College Name as a pure Markdown H1 (e.g., # ${universityName || 'Question Paper'}). DO NOT use HTML tags like <p> or <h1 align="center">.
2. Metadata: On the next line, put: **Subject:** ${subject} | **Branch:** ${branch} | **Semester:** ${semester}. Add a blank line.
3. Time & Marks: **Total Marks:** ${totalMarks} | **Time Allowed:** 3 Hours. (Distribute the marks logically among the questions so they sum exactly to ${totalMarks}). Add a blank line.
4. MCQ Options: You MUST format multiple-choice options as a Markdown unordered list (using dashes). This is extremely important so they render on separate lines.
   Example:
   1. Question text here?
   - A) Option 1
   - B) Option 2
   - C) Option 3
   - D) Option 4
5. Math & Physics Constants: DO NOT USE LaTeX formatting (no $ or $$ symbols). Use standard plain text and unicode characters.
${answerKeyInstruction}` }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: safeMaxTokens, 
      },
    });

    let content = response.text; 
    
    // Fallback: Check for content in parts array if response.text is empty
    if (!content) {
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (parts && parts.length > 0 && parts[0].text) {
          content = parts[0].text; 
      }
      
      // If content is STILL empty, throw a definitive error.
      if (!content) {
          const finishReason = candidate?.finishReason || 'NO_CONTENT_GENERATED';
          console.error("GENERATION BLOCKED/EMPTY:", finishReason);
          throw new Error(`Model generated empty content. Finish Reason: ${finishReason}.`);
      }
    }
    
    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type) 
      VALUES (${userId}, ${`${subject} Question Paper`}, ${content}, 'question-paper') 
    `;

    // 🟢 RE-ENABLING: Only update usage if the plan is NOT premium
    if(plan !== 'premium'){
        await clerkClient.users.updateUserMetadata(userId, {
            privateMetadata:{
                // Increment free_usage only if it's the free plan
                free_usage: free_usage + 1
            }
        })
    }
    
    // Return the actual generated content
    res.json({
      success: true, 
      content: content,
      // Provide an optional warning if the generation stopped early for reasons other than STOP or MAX_TOKENS
      warning: response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== "STOP" && response.candidates[0].finishReason !== "MAX_TOKENS" 
               ? `Note: Generation finished with reason: ${response.candidates?.[0]?.finishReason}.`
               : undefined
    })

  } catch (error) {
    // This catches definitive network errors or the Error thrown above.
    console.error("Controller Error:", error.message);
    res.status(500).json({success: false, message: `Error generating question paper: ${error.message}`}); 
  }
};











export const resumeReview = async (req, res) => {
  try {

    const { userId } = req.auth;
    const resume = req.file;

    // Plan check
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= FREE_USAGE_LIMIT) {
      return res.status(403).json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    // File existence check
    if (!resume || !resume.path) {
      return res.status(400).json({
        success: false,
        message: "Resume upload failed.",
      });
    }

    // File size check (5MB)
    if (resume.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File size exceeds 5MB limit.",
      });
    }

    // Read PDF file
    const dataBuffer = new Uint8Array(
      fs.readFileSync(resume.path)
    );

    // Load PDF
    const pdf = await pdfjsLib.getDocument({
      data: dataBuffer,
    }).promise;

    let resumeText = "";

    // Extract text from all pages
    for (let i = 1; i <= pdf.numPages; i++) {

      const page = await pdf.getPage(i);

      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map(item => item.str)
        .join(" ");

      resumeText += pageText + "\n";
    }

    // Empty text check
    if (!resumeText || resumeText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Could not extract text from resume.",
      });
    }

    // AI Prompt
    const prompt = `
You are an expert ATS resume reviewer.

Analyze the following resume and provide:

1. Overall feedback
2. Resume strengths
3. Weaknesses
4. ATS optimization tips
5. Missing skills or improvements
6. Formatting suggestions
7. Professionalism score out of 10

Resume Content:

${resumeText}
`;

    // Generate AI review
    const response = await AI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    });

    let content = response.text;

    // Fallback extraction
    if (!content) {

      const candidate = response.candidates?.[0];

      const parts = candidate?.content?.parts;

      if (parts && parts.length > 0 && parts[0].text) {
        content = parts[0].text;
      }

      if (!content) {
        throw new Error("AI failed to generate review.");
      }
    }

    // Save to DB
    await sql`
      INSERT INTO creations(user_id, prompt, content, type)
      VALUES (
        ${userId},
        ${"Review the uploaded resume"},
        ${content},
        ${"resume-review"}
      )
    `;

    // Only update usage if the plan is NOT premium
    if (plan !== 'premium') {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1
        }
      });
    }

    // Delete uploaded file
    fs.unlinkSync(resume.path);

    // Response
    return res.json({
      success: true,
      content,
    });

  } catch (error) {

    console.error("Resume Review Error:", error);

    return res.status(500).json({
      success: false,
      message: `Error reviewing resume: ${error.message}`,
    });
  }
};