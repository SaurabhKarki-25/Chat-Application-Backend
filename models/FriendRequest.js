import mongoose from "mongoose";

const FriendRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

// Prevent duplicate pending requests via compound index
FriendRequestSchema.index({ requester: 1, recipient: 1 }, { unique: false });

export default mongoose.model("FriendRequest", FriendRequestSchema);
