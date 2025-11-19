import { clerkClient, getAuth } from "@clerk/express" // Import getAuth

export const auth = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        const userId = auth.userId;

        if (!userId) {
             return res.status(401).json({ 
                success: false, 
                message: "Authentication required. (Check Postman token)" 
            });
        }
        
        // Await the user retrieval to get the definitive metadata
        const user = await clerkClient.users.getUser(userId) 

        // Safe access to free_usage
        let freeUsage = user.privateMetadata?.free_usage ?? 0;
        
        // --- Determine Premium Status (Standard Check Only) ---
        // This is the correct, standard check for Clerk permissions.
        let hasPremiumPlan = await auth.has({ plan: 'premium' }); 
        
        // --- USAGE LOGIC BASED ON STATUS ---
        
        if (hasPremiumPlan) {
            req.plan = 'premium';
            req.free_usage = 0; 
            
            // Force reset the metadata on Clerk's server if the counter is non-zero
            if (freeUsage > 0) {
                await clerkClient.users.updateUserMetadata(userId, {
                    privateMetadata: {
                        free_usage: 0
                    }
                });
            }
        } 
        
        // Handle Free User Logic (when hasPremiumPlan is false)
        else {
            req.plan = 'free';
            req.free_usage = freeUsage;
            
        }
        
        req.auth = auth;
        
        // Final Log (for your verification)
        console.log(`Clerk check complete for user ${userId}. Detected Plan: ${req.plan}. Free Usage Count: ${req.free_usage}. hasPremiumPlan status: ${hasPremiumPlan}`);
        
        next() 
    } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        res.status(500).json({success: false, message: error.message}) 
    }
}
