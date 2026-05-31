import express from "express"
import { auth } from "../middlewares/auth.js";
import { getUserDocuments, getPublishedDocuments, toggleLikeDocument, setRole, postNotification, getNotifications, editNotification, deleteNotification, subscribeNewsletter, askNoticeTutor } from "../controllers/userController.js";
import upload from '../middlewares/multer.js';

const userRouter = express.Router();

userRouter.get("/get-user-documents", auth, getUserDocuments);
userRouter.get("/get-published-documents", auth, getPublishedDocuments);
userRouter.post("/toggle-like-document", auth, toggleLikeDocument);
userRouter.post("/set-role", auth, setRole);

// Notification routes
userRouter.post("/notifications", auth, upload.single('file'), postNotification);
userRouter.get("/notifications", auth, getNotifications);
userRouter.put("/notifications/:id", auth, upload.single('file'), editNotification);
userRouter.delete("/notifications/:id", auth, deleteNotification);

// Subscription route
userRouter.post("/subscribe", subscribeNewsletter);

// Notice Board AI Tutor route
userRouter.post("/notice-tutor", auth, askNoticeTutor);

export default userRouter;