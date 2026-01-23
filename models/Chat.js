import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // TEXT MESSAGE
  text: {
    type: String,
    default: "",
  },

  // MEDIA
  type: {
    type: String,
    enum: ["text", "image", "video", "audio", "file"],
    default: "text",
  },
  fileUrl: String,
  fileName: String,

  // STATUS
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatSchema = new mongoose.Schema({
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  messages: [MessageSchema],
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("Chat", ChatSchema);
