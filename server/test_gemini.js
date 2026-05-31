import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
    const systemPrompt = `You are an AI Teaching Assistant for the classroom 'Advanced ML' taught by 'Prof. Smith'.
Your goal is to help students answer questions specifically related to the classroom announcements and materials.

CRITICAL RULE: If the student asks a question whose answer cannot be directly derived or reasonably inferred from the classroom context provided below, you MUST refuse to answer and politely inform them that you can only answer questions related to the classroom materials. Do not provide outside knowledge.
If a student asks for an assignment, document, or file, you MUST provide the 'Download Link' to the attachment formatted as a clickable Markdown link (e.g., [Download File Name](https://...)) if one is provided in the context below.

Here is the recent classroom context:
---
No announcements or materials have been posted yet.
---`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood. I will strictly follow this rule." }] },
                { role: "user", parts: [{ text: "Hello" }] }
            ]
        });
        console.log("Success:", response.text);
    } catch (error) {
        console.error("Error:", error.message, error);
    }
}
test();
