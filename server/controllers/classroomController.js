import sql from '../configs/db.js';
import { clerkClient } from "@clerk/express";
import { v2 as cloudinary } from 'cloudinary';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to generate a random 6-character alphanumeric code
const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createClassroom = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { name, subject } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Verify the user is a teacher
        const user = await clerkClient.users.getUser(userId);
        if (user.publicMetadata?.role !== 'teacher') {
            return res.status(403).json({ success: false, message: "Only teachers can create classrooms." });
        }

        const teacherName = user.fullName || "Teacher";
        const inviteCode = generateInviteCode();

        const [classroom] = await sql`
            INSERT INTO classrooms (teacher_id, teacher_name, name, subject, invite_code)
            VALUES (${userId}, ${teacherName}, ${name}, ${subject}, ${inviteCode})
            RETURNING *
        `;

        res.json({ success: true, message: "Classroom created successfully", data: classroom });
    } catch (error) {
        console.error("Error creating classroom:", error);
        res.json({ success: false, message: error.message });
    }
};

export const joinClassroom = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { inviteCode } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const user = await clerkClient.users.getUser(userId);
        const studentName = user.fullName || "Student";

        // Find classroom by invite code
        const classrooms = await sql`SELECT * FROM classrooms WHERE invite_code = ${inviteCode.toUpperCase()}`;
        if (classrooms.length === 0) {
            return res.json({ success: false, message: "Invalid invite code. Classroom not found." });
        }

        const classroom = classrooms[0];

        // Check if already joined
        const existing = await sql`
            SELECT * FROM classroom_students 
            WHERE classroom_id = ${classroom.id} AND student_id = ${userId}
        `;

        if (existing.length > 0) {
            return res.json({ success: false, message: "You have already joined this classroom." });
        }

        await sql`
            INSERT INTO classroom_students (classroom_id, student_id, student_name)
            VALUES (${classroom.id}, ${userId}, ${studentName})
        `;

        res.json({ success: true, message: "Successfully joined classroom!", data: classroom });
    } catch (error) {
        console.error("Error joining classroom:", error);
        res.json({ success: false, message: error.message });
    }
};

export const getMyClassrooms = async (req, res) => {
    try {
        const { userId } = req.auth;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const user = await clerkClient.users.getUser(userId);
        const isTeacher = user.publicMetadata?.role === 'teacher';

        let classrooms = [];

        if (isTeacher) {
            classrooms = await sql`
                SELECT * FROM classrooms 
                WHERE teacher_id = ${userId} 
                ORDER BY created_at DESC
            `;
        } else {
            classrooms = await sql`
                SELECT c.*, cs.joined_at 
                FROM classrooms c
                JOIN classroom_students cs ON c.id = cs.classroom_id
                WHERE cs.student_id = ${userId}
                ORDER BY cs.joined_at DESC
            `;
        }

        res.json({ success: true, data: classrooms, isTeacher });
    } catch (error) {
        console.error("Error fetching classrooms:", error);
        res.json({ success: false, message: error.message });
    }
};

export const getClassroomDetail = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const classrooms = await sql`SELECT * FROM classrooms WHERE id = ${id}`;
        if (classrooms.length === 0) return res.status(404).json({ success: false, message: "Classroom not found" });

        const classroom = classrooms[0];
        
        // Fetch students
        const students = await sql`
            SELECT student_id, student_name, joined_at 
            FROM classroom_students 
            WHERE classroom_id = ${id}
            ORDER BY joined_at DESC
        `;

        // Check authorization (must be teacher or enrolled student)
        const isTeacher = classroom.teacher_id === userId;
        const isEnrolled = students.some(s => s.student_id === userId);

        if (!isTeacher && !isEnrolled) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Fetch posts
        const posts = await sql`
            SELECT id, teacher_id, teacher_name, content, created_at, attachment_url, attachment_name
            FROM classroom_posts
            WHERE classroom_id = ${id}
            ORDER BY created_at DESC
        `;

        res.json({ 
            success: true, 
            data: { 
                ...classroom, 
                students,
                posts
            },
            isTeacher
        });
    } catch (error) {
        console.error("Error fetching classroom details:", error);
        res.json({ success: false, message: error.message });
    }
};

export const createPost = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params; // classroom ID
        const { content } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!content || !content.trim()) return res.status(400).json({ success: false, message: "Post content cannot be empty" });

        // Verify the user is the teacher of this classroom
        const classrooms = await sql`SELECT * FROM classrooms WHERE id = ${id}`;
        if (classrooms.length === 0) return res.status(404).json({ success: false, message: "Classroom not found" });

        const classroom = classrooms[0];
        if (classroom.teacher_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the teacher can post in this classroom" });
        }

        let attachmentUrl = null;
        let attachmentName = null;

        if (req.file) {
            // Upload to Cloudinary
            const base64File = Buffer.from(req.file.buffer).toString('base64');
            const dataURI = `data:${req.file.mimetype};base64,${base64File}`;
            
            // If it's an image, let Cloudinary handle it as an image. Otherwise, treat as raw file (PDF, Doc)
            const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';
            
            const uploadOptions = {
                resource_type: resourceType,
                folder: "gestro/classrooms"
            };

            if (resourceType === 'raw') {
                // Ensure the extension is preserved for raw files so they download correctly
                const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
                uploadOptions.public_id = `${Date.now()}_${safeName}`;
            }
            
            const uploadResponse = await cloudinary.uploader.upload(dataURI, uploadOptions);
            
            attachmentUrl = uploadResponse.secure_url;
            attachmentName = req.file.originalname;
        }

        const [post] = await sql`
            INSERT INTO classroom_posts (classroom_id, teacher_id, teacher_name, content, attachment_url, attachment_name)
            VALUES (${id}, ${userId}, ${classroom.teacher_name}, ${content}, ${attachmentUrl}, ${attachmentName})
            RETURNING id, teacher_id, teacher_name, content, created_at, attachment_url, attachment_name
        `;

        res.json({ success: true, message: "Post created successfully", data: post });
    } catch (error) {
        console.error("Error creating post:", error);
        res.json({ success: false, message: error.message });
    }
};

export const editPost = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { postId } = req.params;
        const { content } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!content || !content.trim()) return res.status(400).json({ success: false, message: "Post content cannot be empty" });

        // Find the post
        const posts = await sql`SELECT * FROM classroom_posts WHERE id = ${postId}`;
        if (posts.length === 0) return res.status(404).json({ success: false, message: "Post not found" });

        const post = posts[0];
        
        // Verify the user is the teacher who created the post
        if (post.teacher_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the teacher who created this post can edit it" });
        }

        const [updatedPost] = await sql`
            UPDATE classroom_posts 
            SET content = ${content}
            WHERE id = ${postId}
            RETURNING id, teacher_id, teacher_name, content, created_at
        `;

        res.json({ success: true, message: "Post updated successfully", data: updatedPost });
    } catch (error) {
        console.error("Error updating post:", error);
        res.json({ success: false, message: error.message });
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

export const deletePost = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { postId } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Find the post
        const posts = await sql`SELECT * FROM classroom_posts WHERE id = ${postId}`;
        if (posts.length === 0) return res.status(404).json({ success: false, message: "Post not found" });

        const post = posts[0];
        
        // Verify the user is the teacher who created the post
        if (post.teacher_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the teacher who created this post can delete it" });
        }

        if (post.attachment_url) {
            await deleteFromCloudinary(post.attachment_url);
        }

        await sql`DELETE FROM classroom_posts WHERE id = ${postId}`;

        res.json({ success: true, message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.json({ success: false, message: error.message });
    }
};

export const deleteClassroom = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Verify teacher
        const classrooms = await sql`SELECT * FROM classrooms WHERE id = ${id}`;
        if (classrooms.length === 0) return res.status(404).json({ success: false, message: "Classroom not found" });

        if (classrooms[0].teacher_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the teacher can delete this classroom" });
        }

        // Because of ON DELETE CASCADE, deleting the classroom deletes the posts and student enrollments.
        await sql`DELETE FROM classrooms WHERE id = ${id}`;

        res.json({ success: true, message: "Classroom deleted successfully" });
    } catch (error) {
        console.error("Error deleting classroom:", error);
        res.json({ success: false, message: error.message });
    }
};

export const removeStudent = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id, studentId } = req.params;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        // Verify teacher
        const classrooms = await sql`SELECT * FROM classrooms WHERE id = ${id}`;
        if (classrooms.length === 0) return res.status(404).json({ success: false, message: "Classroom not found" });

        if (classrooms[0].teacher_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the teacher can remove students from this classroom" });
        }

        await sql`DELETE FROM classroom_students WHERE classroom_id = ${id} AND student_id = ${studentId}`;

        res.json({ success: true, message: "Student removed successfully" });
    } catch (error) {
        console.error("Error removing student:", error);
        res.json({ success: false, message: error.message });
    }
};

export const askTutor = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { id } = req.params;
        const { message, history } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!message) return res.status(400).json({ success: false, message: "Message is required" });

        // Verify the user is either the teacher or an enrolled student
        const classrooms = await sql`SELECT * FROM classrooms WHERE id = ${id}`;
        if (classrooms.length === 0) return res.status(404).json({ success: false, message: "Classroom not found" });
        const classroom = classrooms[0];

        if (classroom.teacher_id !== userId) {
            const enrollments = await sql`SELECT * FROM classroom_students WHERE classroom_id = ${id} AND student_id = ${userId}`;
            if (enrollments.length === 0) {
                return res.status(403).json({ success: false, message: "You must be enrolled to use the tutor" });
            }
        }

        // Fetch recent posts to provide context
        const posts = await sql`
            SELECT teacher_name, content, attachment_name, attachment_url, created_at 
            FROM classroom_posts 
            WHERE classroom_id = ${id} 
            ORDER BY created_at DESC 
            LIMIT 15
        `;

        let contextText = "No announcements or materials have been posted yet.";
        if (posts.length > 0) {
            contextText = posts.map(p => 
                `[Posted on ${new Date(p.created_at).toLocaleDateString()} by ${p.teacher_name}]:\n${p.content}\nAttachment: ${p.attachment_name || 'None'}${p.attachment_url ? ` (Download Link: ${p.attachment_url})` : ''}`
            ).join('\n\n');
        }

        const systemPrompt = `You are an AI Teaching Assistant for the classroom '${classroom.name}' taught by '${classroom.teacher_name}'.
Your goal is to help students answer questions specifically related to the classroom announcements and materials.

CRITICAL RULE: If the student asks a question whose answer cannot be directly derived or reasonably inferred from the classroom context provided below, you MUST refuse to answer and politely inform them that you can only answer questions related to the classroom materials. Do not provide outside knowledge.
If a student asks for an assignment, document, or file, you MUST provide the 'Download Link' to the attachment formatted as a clickable Markdown link (e.g., [Download File Name](https://...)) if one is provided in the context below.

Here is the recent classroom context:
---
${contextText}
---`;

        const response = await ai.models.generateContent({
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
        console.error("Error with tutor:", error);
        res.json({ success: false, message: "Failed to get response from AI Tutor" });
    }
};
