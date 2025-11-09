import express from "express";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper: ensure both users are friends before allowing chat creation/retrieval
const areFriends = async (userId, otherId) => {
  const user = await User.findById(userId).select("friends");
  if (!user) return false;
  return user.friends.some((f) => String(f) === String(otherId));
};

// Get chat between logged-in user and friend by friend's username
router.get("/:username", protect, async (req, res) => {
  try {
    const friend = await User.findOne({ username: req.params.username });
    if (!friend) return res.status(404).json({ message: "User not found" });

    // security: ensure the two are friends
    const allowed = await areFriends(req.user.id, friend._id);
    if (!allowed) return res.status(403).json({ message: "Not authorized to view this chat" });

    const chat = await Chat.findOne({
      participants: { $all: [req.user.id, friend._id] },
    }).populate("messages.senderId", "username");

    res.json(chat || { messages: [] });
  } catch (err) {
    console.error("Chat get error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Send a message to username — only if they are friends
router.post("/:username", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "Empty message" });

    const friend = await User.findOne({ username: req.params.username });
    if (!friend) return res.status(404).json({ message: "User not found" });

    // security check
    const allowed = await areFriends(req.user.id, friend._id);
    if (!allowed) return res.status(403).json({ message: "Not authorized to send to this user" });

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, friend._id] },
    });

    if (!chat) {
      chat = await Chat.create({ participants: [req.user.id, friend._id], messages: [] });
    }

    const newMessage = {
      senderId: req.user.id,
      text,
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
    chat.lastUpdated = new Date();
    await chat.save();

    // emit via socket (send to friend only)
    const io = req.app.get("io");
    if (io) {
      io.to(String(friend._id)).emit("receiveMessage", {
        senderId: req.user.id,
        message: text,
        timestamp: newMessage.timestamp,
      });
    }

    res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    console.error("Chat post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
