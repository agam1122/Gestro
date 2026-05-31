import sql from '../configs/db.js';
import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { GoogleGenAI } from "@google/genai";


export const getUserDocuments = async (req, res) => {
    try {
        const { userId } = req.auth;
        const creations = await sql`
            SELECT * FROM creations
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `; 
        res.json({success: true, data: creations})
        // console.log(creations)

    } catch (error) {
        res.json({success: false, message: error.message})
    }
}



export const getPublishedDocuments = async (req, res) => {
    try {
        const creations = await sql`
            SELECT * FROM creations
            WHERE publish = true
            ORDER BY created_at DESC
        `; 
        res.json({success: true, data: creations})
        
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}



export const toggleLikeDocument = async (req, res) => {
    try {

        const {userId} = req.auth;
        const {id} = req.body;

        const [creation] = await sql`
            SELECT * FROM creations
            WHERE id = ${id}
        `;

        if(!creation) {
            return res.status(404).json({success: false, message: "Creation not found"});
        }

        const currentLikes = creation.likes;
        const userIdStr = userId.toString();
        let updatedLikes;
        let message;

        if(currentLikes.includes(userIdStr)) {
            // Unlike
            updatedLikes = currentLikes.filter((user) => user !== userIdStr); 
            message = "Creation unliked";
        } else {
            // Like
            updatedLikes = [...currentLikes, userIdStr];
            message = "Creation liked";
        }

        const formattedArray = `{${updatedLikes.join(",")}}`;

        await sql`
            UPDATE creations
            SET likes = ${formattedArray}::text[]
            WHERE id = ${id}
        `; 

        
        res.json({success: true, data: message})
        
    } catch (error) {
        res.json({success: false, message: error.message})
    }
}

export const setRole = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { role, secretCode } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (role !== "student" && role !== "teacher") {
            return res.status(400).json({ success: false, message: "Invalid role" });
        }

        if (role === "teacher") {
            const expectedCode = process.env.TEACHER_SECRET_CODE || 'GESTRO-TEACH-2026';
            if (secretCode !== expectedCode) {
                return res.status(403).json({ success: false, message: "Invalid Teacher Access Code" });
            }
        }

        await clerkClient.users.updateUserMetadata(userId, {
            publicMetadata: {
                role: role
            }
        });

        res.json({ success: true, message: `Successfully updated role to ${role}` });
    } catch (error) {
        console.error("setRole error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

export const postNotification = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { title, content } = req.body;
        const file = req.file;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!title || !content) return res.status(400).json({ success: false, message: "Title and content are required" });

        // Verify the user is the admin
        const user = await clerkClient.users.getUser(userId);
        const userEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
        
        if (userEmail !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: "Only the admin can post notifications" });
        }

        let attachmentUrl = null;
        let attachmentName = null;

        if (file) {
            try {
                const base64File = Buffer.from(file.buffer).toString('base64');
                const dataURI = `data:${file.mimetype};base64,${base64File}`;
                const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
                
                const uploadOptions = {
                    resource_type: resourceType,
                    folder: "gestro/notifications"
                };

                if (resourceType === 'raw') {
                    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                    uploadOptions.public_id = `${Date.now()}_${safeName}`;
                }
                
                const uploadResult = await cloudinary.uploader.upload(dataURI, uploadOptions);
                attachmentUrl = uploadResult.secure_url;
                attachmentName = file.originalname;
            } catch (uploadError) {
                console.error("Cloudinary upload error:", uploadError);
                return res.status(500).json({ success: false, message: "Failed to upload file to Cloudinary" });
            }
        }

        const notification = await sql`
            INSERT INTO creations (user_id, prompt, content, type, publish, attachment_url, attachment_name)
            VALUES (${userId}, ${title}, ${content}, 'notification', true, ${attachmentUrl}, ${attachmentName})
            RETURNING *
        `;

        res.json({ success: true, data: notification[0] });
    } catch (error) {
        console.error("postNotification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getNotifications = async (req, res) => {
    try {
        const notifications = await sql`
            SELECT * FROM creations
            WHERE type = 'notification' AND publish = true
            ORDER BY created_at DESC
        `;
        res.json({ success: true, data: notifications });
    } catch (error) {
        console.error("getNotifications error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editNotification = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;
        const { title, content, removeAttachment } = req.body;
        const file = req.file;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const user = await clerkClient.users.getUser(userId);
        const userEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
        
        if (userEmail !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: "Only the admin can edit notifications" });
        }

        // Fetch existing notification
        const existing = await sql`SELECT * FROM creations WHERE id = ${id} AND type = 'notification'`;
        if (existing.length === 0) return res.status(404).json({ success: false, message: "Notification not found" });

        let attachmentUrl = existing[0].attachment_url;
        let attachmentName = existing[0].attachment_name;

        if (removeAttachment === 'true') {
            attachmentUrl = null;
            attachmentName = null;
        } else if (file) {
            try {
                const base64File = Buffer.from(file.buffer).toString('base64');
                const dataURI = `data:${file.mimetype};base64,${base64File}`;
                const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
                
                const uploadOptions = {
                    resource_type: resourceType,
                    folder: "gestro/notifications"
                };

                if (resourceType === 'raw') {
                    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                    uploadOptions.public_id = `${Date.now()}_${safeName}`;
                }
                
                const uploadResult = await cloudinary.uploader.upload(dataURI, uploadOptions);
                attachmentUrl = uploadResult.secure_url;
                attachmentName = file.originalname;
            } catch (uploadError) {
                console.error("Cloudinary upload error during edit:", uploadError);
                return res.status(500).json({ success: false, message: "Failed to upload file to Cloudinary" });
            }
        }

        const updated = await sql`
            UPDATE creations 
            SET prompt = ${title}, content = ${content}, attachment_url = ${attachmentUrl}, attachment_name = ${attachmentName}, updated_at = NOW()
            WHERE id = ${id} AND type = 'notification'
            RETURNING *
        `;

        res.json({ success: true, data: updated[0] });
    } catch (error) {
        console.error("editNotification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteFromCloudinary = async (url) => {
    if (!url) return;
    try {
        const isRaw = url.includes('/raw/upload/');
        const isImage = url.includes('/image/upload/');
        
        let resourceType = 'image';
        if (isRaw) resourceType = 'raw';
        
        const urlParts = url.split('/upload/');
        if (urlParts.length === 2) {
            let path = urlParts[1];
            if (path.match(/^v\d+\//)) {
                path = path.replace(/^v\d+\//, '');
            }
            if (isImage) {
                path = path.substring(0, path.lastIndexOf('.')) || path;
            }
            await cloudinary.uploader.destroy(path, { resource_type: resourceType });
        }
    } catch (err) {
        console.error("Cloudinary deletion failed:", err);
    }
};

export const deleteNotification = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const user = await clerkClient.users.getUser(userId);
        const userEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
        
        if (userEmail !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: "Only the admin can delete notifications" });
        }

        const deleted = await sql`
            DELETE FROM creations 
            WHERE id = ${id} AND type = 'notification'
            RETURNING *
        `;

        if (deleted.length === 0) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        if (deleted[0].attachment_url) {
            await deleteFromCloudinary(deleted[0].attachment_url);
        }

        res.json({ success: true, message: "Notification deleted successfully" });
    } catch (error) {
        console.error("deleteNotification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const subscribeNewsletter = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        // Check if already subscribed
        const existing = await sql`
            SELECT id FROM creations WHERE type = 'subscriber' AND prompt = ${email}
        `;

        if (existing.length > 0) {
            return res.json({ success: true, message: "Already subscribed!" });
        }

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES ('guest', ${email}, 'subscribed', 'subscriber')
        `;

        res.json({ success: true, message: "Successfully subscribed to campus updates!" });
    } catch (error) {
        console.error("subscribeNewsletter error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const askNoticeTutor = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { message, history } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!message) return res.status(400).json({ success: false, message: "Message is required" });

        // Initialize Chatbot API client with fallback to read .env
        let chatbotApiKey = process.env.CHATBOT_API_KEY;
        if (!chatbotApiKey) {
            try {
                const envContent = fs.readFileSync('.env', 'utf-8');
                const match = envContent.match(/CHATBOT_API_KEY=(.+)/);
                if (match) chatbotApiKey = match[1].trim();
            } catch(e) {
                console.error("Failed to read .env file", e);
            }
        }
        
        if (!chatbotApiKey) {
            return res.status(500).json({ success: false, message: "Chatbot API Key is missing in server configuration." });
        }
        
        const aiChatbot = new GoogleGenAI({ apiKey: chatbotApiKey });

        // Fetch recent notices
        const notices = await sql`
            SELECT prompt as title, content as description, attachment_name, attachment_url, created_at
            FROM creations
            WHERE type = 'notification'
            ORDER BY created_at DESC
            LIMIT 20
        `;

        let contextText = "No notices or announcements have been posted yet.";
        if (notices.length > 0) {
            contextText = notices.map(n => 
                `[Posted on ${new Date(n.created_at).toLocaleDateString()}]:\nTitle: ${n.title}\nDescription: ${n.description}\nAttachment: ${n.attachment_name || 'None'}${n.attachment_url ? ` (Download Link: ${n.attachment_url})` : ''}`
            ).join('\n\n');
        }

        const systemPrompt = `You are an AI Notice Board Assistant for Gestro.
Your goal is to help users answer questions specifically related to the campus announcements and notices provided below.

CRITICAL RULE: If the user asks a question whose answer cannot be directly derived or reasonably inferred from the Notice Board context provided below, you MUST refuse to answer and politely inform them that you can only answer questions related to the official campus announcements. Do not provide outside knowledge.
If a user asks for a document, file, or attachment related to a notice, you MUST provide the 'Download Link' formatted as a clickable Markdown link (e.g., [Download File Name](https://...)) if one is provided in the context below.

Here is the recent Notice Board context:
---
${contextText}
---`;

        const response = await aiChatbot.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood. I will strictly follow this rule." }] },
                ...history,
                { role: "user", parts: [{ text: message }] }
            ]
        });

        res.json({ success: true, text: response.text });
    } catch (error) {
        console.error("Error with notice tutor:", error);
        res.json({ success: false, message: "Failed to get response from AI Notice Tutor" });
    }
};
