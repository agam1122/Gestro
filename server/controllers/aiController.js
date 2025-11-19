import { GoogleGenAI } from "@google/genai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import {v2 as cloudinary} from 'cloudinary';
import FormData from "form-data";


const AI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MAX_OUTPUT_TOKENS_BUFFER = 1500; 
const FREE_USAGE_LIMIT = 1000;



//Article generation function
export const generateArticle = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const { prompt, length } = req.body;
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    const free_usage = req.free_usage; 
    
    // Convert requested length to a number
    const requestedLengthNum = parseInt(length, 10);
    // Set maxOutputTokens to requested length + buffer
    const safeMaxTokens = requestedLengthNum + MAX_OUTPUT_TOKENS_BUFFER; 

    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" && free_usage >= FREE_USAGE_LIMIT) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    
    // CORE LOGIC: We rely on the prompt to hit the target length.
    const response = await AI.models.generateContent({
      model: "gemini-2.5-flash", 
      // Inject a strong instruction to enforce the length
      contents: [{ role: "user", parts: [{ text: `Generate a detailed article based on this prompt: ${prompt}. The article MUST be approximately ${requestedLengthNum} tokens long.` }] }],
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
          throw new Error(`Model generated empty content. Finish Reason: ${finishReason}. Please try a slightly larger length in the body (e.g., 850 instead of 800).`);
      }
    }
    
    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type) 
      VALUES (${userId}, ${prompt}, ${content}, 'article') 
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
    res.status(500).json({success: false, message: `Error generating article: ${error.message}`}); 
  }
};





//Blog Title generation function
export const generateBlogTitle = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const { prompt } = req.body;
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    const free_usage = req.free_usage; 
    

    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" && free_usage >= FREE_USAGE_LIMIT) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    
    // CORE LOGIC: We rely on the prompt to hit the target length.
    const response = await AI.models.generateContent({
      model: "gemini-2.5-flash", 
      // Inject a strong instruction to enforce the length
      contents: [{ role: "user", parts: [{ text: `Generate 5 compelling and concise blog title options for an article about: ${prompt}` }] }],
      config: {
        temperature: 0.7,
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
          throw new Error(`Model generated empty content. Finish Reason: ${finishReason}. Please try a slightly larger length in the body (e.g., 850 instead of 800).`);
      }
    }
    
    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type) 
      VALUES (${userId}, ${prompt}, ${content}, 'blog-title') 
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
    res.status(500).json({success: false, message: `Error generating article: ${error.message}`}); 
  }
};





//Image generation function
export const generateImage = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const { prompt, publish } = req.body;
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    
    
    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" ) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    
    // CORE LOGIC: We rely on the prompt to hit the target length.
    const formData = new FormData()
    formData.append('prompt', prompt)
    const {data} = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
      headers: { 'x-api-key': process.env.CLIPDROP_API_KEY, },
      responseType: 'arraybuffer' 
    })
    

    const base64Image = `data:image/png;base64,${Buffer.from(data, 'binary').toString('base64')}`;

    let secure_url = '';
    // If publish is true, upload to Cloudinary
    if (publish) {
      const uploadResult = await cloudinary.uploader.upload(base64Image);
      secure_url = uploadResult.secure_url; 
    } else {
        // If not publishing, save the Base64 image data as the content string
        secure_url = base64Image;
    }

    const contentToSave = secure_url;

    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type, publish) 
      VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false}) 
    `;

    
    
    // Return the actual generated content
    res.json({
      success: true, 
      content: contentToSave,
    })

  } catch (error) {
    // This catches definitive network errors or the Error thrown above.
    console.error("Controller Error:", error.message);
    res.status(500).json({success: false, message: `Error generating image: ${error.message}`}); 
  }
};






//Image background removal function
export const removeImageBackground = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const image = req.file;
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    
    
    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" ) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const {secure_url} = await cloudinary.uploader.upload(image.path, {
      transformation: [
        { 
          effect: "background_removal" , 
          background_removal: "remove_the_background",
        }
      ],
    }); 
    

    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type) 
      VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
    `;

    
    
    // Return the actual generated content
    res.json({
      success: true, 
      content: secure_url,
    })

  } catch (error) {
    // This catches definitive network errors or the Error thrown above.
    console.error("Controller Error:", error.message);
    res.status(500).json({success: false, message: `Error generating image: ${error.message}`}); 
  }
};










//Object removal function
export const removeImageObject = async (req, res) => {
  try {
    
    const { userId } = req.auth; 
    const { object } = req.body; 
    const image = req.file;
    
    // 🟢 RE-ENABLING: Get the plan and usage from auth.js
    const plan = req.plan; 
    
    
    // 🟢 RE-ENABLING: Final Limit Check
    if (plan !== "premium" ) {
      return res.status(403).json({ 
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const {public_id} = await cloudinary.uploader.upload(image.path); 

    const image_url = cloudinary.url(public_id, {
      transformation: [
        {
          effect: `gen_remove:${object}`,
        },
      ],
      resource_type: "image",
    });
    

    // If execution reaches here, 'content' is guaranteed to be a non-null string
    await sql` 
      INSERT INTO creations(user_id, prompt, content, type) 
      VALUES (${userId}, ${`Removed ${object} from image`}, ${image_url}, 'image')
    `;

    
    
    // Return the actual generated content
    res.json({
      success: true, 
      content: image_url,
    })

  } catch (error) {
    // This catches definitive network errors or the Error thrown above.
    console.error("Controller Error:", error.message);
    res.status(500).json({success: false, message: `Error generating image: ${error.message}`}); 
  }
};





//Resume reviewing function 
export const resumeReview = async (req, res) => {}

// export const resumeReview = async (req, res) => {
//   try {
    
//     const { userId } = req.auth; 
//     const resume = req.file;
    
//     // 🟢 Get the plan and usage from auth.js
//     const plan = req.plan; 
    
    
//     // 🟢 Final Limit Check
//     if (plan !== "premium" ) {
//       return res.status(403).json({ 
//         success: false,
//         message: "Limit reached. Upgrade to continue.",
//       });
//     }

//     // 🛑 Check for file upload failure before reading path
//     if (!resume || !resume.path) {
//         return res.status(400).json({
//             success: false,
//             message: "Resume file upload failed. Please ensure file is valid and under 5MB."
//         });
//     }

//     if(resume.size > 5 * 1024 * 1024){
//       res.json({success: false, message: "File size exceeds 5MB limit."});
//     }
    
//     const dataBuffer = fs.readFile(resume.path);
    

//     const pdfData = await pdfParser.default(dataBuffer);
//     const text = pdfData.text;

//     const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses and areas for improvement. Resume content:\n\n${text}`; 

//     // CORE LOGIC: We rely on the prompt to hit the target length.
//     const response = await AI.models.generateContent({
//       model: "gemini-2.5-flash",
//       // Inject a strong instruction to enforce the length
//       contents: [{ role: "user", parts: [{ text: `${prompt}` }] }],
//       config: {
//         temperature: 0.7,
//         maxOutputTokens: 1000, // Increased for a proper review
//       },
//     });

//     let content = response.text; 

//     // If execution reaches here, 'content' is guaranteed to be a non-null string
//     await sql` 
//       INSERT INTO creations(user_id, prompt, content, type) 
//       VALUES (${userId}, "Review the uploaded resume", ${content}, 'resume-review')
//     `;

    
    
//     // Return the actual generated content
//     res.json({
//       success: true, 
//       content: content,
//     })

//   } catch (error) {
//     // This catches definitive network errors or the Error thrown above.
//     console.error("Controller Error:", error.message);
//     res.status(500).json({success: false, message: `Error generating image: ${error.message}`}); 
//   }
// };


