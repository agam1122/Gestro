import sql from '../configs/db.js';
import { clerkClient } from "@clerk/express";

export const getPage = async (req, res) => {
    try {
        const { slug } = req.params;
        const pages = await sql`
            SELECT content FROM creations 
            WHERE type = 'page' AND prompt = ${slug}
        `;
        
        if (pages.length === 0) {
            return res.json({ success: true, data: { content: "# Page content coming soon...\nThis page has not been created yet." } });
        }
        
        res.json({ success: true, data: { content: pages[0].content } });
    } catch (error) {
        console.error("getPage error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updatePage = async (req, res) => {
    try {
        const { userId } = req.auth;
        const { slug } = req.params;
        const { content } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const user = await clerkClient.users.getUser(userId);
        const userEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
        
        if (userEmail !== process.env.ADMIN_EMAIL) {
            return res.status(403).json({ success: false, message: "Only the admin can edit pages" });
        }

        const existing = await sql`
            SELECT id FROM creations WHERE type = 'page' AND prompt = ${slug}
        `;

        if (existing.length > 0) {
            await sql`
                UPDATE creations 
                SET content = ${content}, updated_at = NOW()
                WHERE id = ${existing[0].id}
            `;
        } else {
            await sql`
                INSERT INTO creations (user_id, prompt, content, type)
                VALUES (${userId}, ${slug}, ${content}, 'page')
            `;
        }

        res.json({ success: true, message: "Page updated successfully" });
    } catch (error) {
        console.error("updatePage error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
