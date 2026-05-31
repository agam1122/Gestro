import express from "express";
import { getPage, updatePage } from "../controllers/pageController.js";
import { requireAuth } from '@clerk/express';

const pageRouter = express.Router();

pageRouter.get("/:slug", getPage);
pageRouter.put("/:slug", requireAuth(), updatePage);

export default pageRouter;
