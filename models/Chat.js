import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  messages: [MessageSchema],
  lastUpdated: { type: Date, default: Date.now },
});

// ensure each chat is unique for the same pair (unordered)
ChatSchema.index({ participants: 1 }, { unique: false });

export default mongoose.model("Chat", ChatSchema);
