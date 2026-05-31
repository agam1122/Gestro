import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const AI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function test() {
  try {
    const response = await AI.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: [{ role: "user", parts: [{ text: `Generate a professional engineering college question paper...` }] }],
      config: {
        temperature: 0.7,
        maxOutputTokens: 2500, 
      },
    });
    console.log("Success:", response.text ? "Has text" : "No text");
  } catch (error) {
    console.error("API Error:", error.message);
  }
}

test();
