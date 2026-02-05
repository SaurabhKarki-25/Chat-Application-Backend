import express from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ================= HELPER ================= */
const areFriends = async (userId, otherId) => {
  const user = await User.findById(userId).select("friends");
  if (!user) return false;

  return user.friends.some(
    (f) => String(f) === String(otherId)
  );
};

/* ================= GET CHAT ================= */
router.get("/:username", protect, async (req, res) => {
  try {
    const friend = await User.findOne({
      username: req.params.username,
    });

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    const allowed = await areFriends(req.user.id, friend._id);

    if (!allowed) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const chat = await Chat.findOne({
      participants: { $all: [req.user.id, friend._id] },
    }).populate("messages.senderId", "username");

    res.json(chat || { messages: [] });

  } catch (err) {
    console.error("Chat GET error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= SEND MESSAGE ================= */
router.post("/:username", protect, async (req, res) => {
  try {
    const {
      text = "",
      type = "text",
      fileUrl = "",
      fileName = "",
    } = req.body;

    if ((!text || !text.trim()) && !fileUrl) {
      return res.status(400).json({
        message: "Empty message",
      });
    }

    const friend = await User.findOne({
      username: req.params.username,
    });

    if (!friend) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const allowed = await areFriends(
      req.user.id,
      friend._id
    );

    if (!allowed) {
      return res.status(403).json({
        message: "Not friends",
      });
    }

    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, friend._id] },
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [
          new mongoose.Types.ObjectId(req.user.id),
          friend._id,
        ],
        messages: [],
      });
    }

    /* ✅ CRITICAL FIX HERE */
    const newMessage = {
      senderId: new mongoose.Types.ObjectId(req.user.id),
      text,
      type,
      fileUrl,
      fileName,
      timestamp: new Date(),
    };

    chat.messages.push(newMessage);
    chat.lastUpdated = new Date();

    await chat.save();

    /* 🔴 SOCKET EMIT */
    const io = req.app.get("io");

    if (io) {
      io.to(String(friend._id)).emit(
        "receiveMessage",
        {
          ...newMessage,
          senderName: req.user.username,
        }
      );
    }

    res.status(201).json(newMessage);

  } catch (err) {
    console.error("Chat POST error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

export default router;
