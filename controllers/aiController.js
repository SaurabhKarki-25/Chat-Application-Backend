import { getAIResponse } from "../services/aiServices.js";
import { AI_USER } from "../config/aiUser.js";

export const aiChatController = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are ChatVerse AI. Reply like Meta AI: friendly, short, helpful, emojis sometimes 😊",
      },
      ...history,
      { role: "user", content: message },
    ];

    const reply = await getAIResponse(messages);

    res.json({
      senderId: AI_USER._id,
      senderName: AI_USER.username,
      text: reply,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.status(500).json({
      senderId: AI_USER._id,
      senderName: AI_USER.username,
      text: "⚠️ AI failed to respond",
      timestamp: new Date(),
    });
  }
};
