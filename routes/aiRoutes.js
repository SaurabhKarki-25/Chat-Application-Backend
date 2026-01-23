import express from "express";
import { aiChatController } from "../controllers/aiController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/chat", protect, aiChatController);

export default router;
