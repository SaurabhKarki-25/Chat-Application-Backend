import express from "express";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Send friend request (create pending)
router.post("/request/:id", protect, async (req, res) => {
  try {
    const recipientId = req.params.id;
    const requesterId = req.user.id;

    if (recipientId === requesterId) {
      return res.status(400).json({ message: "You cannot add yourself" });
    }

    // Avoid duplicate pending request in either direction
    const existing = await FriendRequest.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId, status: "pending" },
        { requester: recipientId, recipient: requesterId, status: "pending" },
      ],
    });

    if (existing) return res.status(400).json({ message: "Request already pending" });

    const alreadyFriends = await User.exists({
      _id: requesterId,
      friends: recipientId,
    });

    if (alreadyFriends) return res.status(400).json({ message: "Already friends" });

    const newRequest = await FriendRequest.create({
      requester: requesterId,
      recipient: recipientId,
    });

    // notify recipient via socket (if available)
    const io = req.app.get("io");
    if (io) {
      io.to(recipientId.toString()).emit("friendRequestReceived", {
        id: newRequest._id,
        from: requesterId,
      });
    }

    res.status(201).json({ success: true, request: newRequest });
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get pending requests that are for the logged-in user (recipient) OR sent by them
// but in the UI you requested pending only as recipient for mailbox; server returns recipient view
router.get("/pending", protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate("requester", "username email");

    res.json(requests);
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Accept friend request (only recipient can accept)
router.put("/accept/:id", protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (String(request.recipient) !== String(req.user.id))
      return res.status(403).json({ message: "Not authorized" });

    if (request.status === "accepted")
      return res.status(400).json({ message: "Request already accepted" });

    // mark accepted
    request.status = "accepted";
    await request.save();

    const receiverId = req.user.id; // who accepted (recipient)
    const senderId = request.requester; // original requester

    // fetch both users
    const [receiver, sender] = await Promise.all([
      User.findById(receiverId),
      User.findById(senderId),
    ]);

    if (!receiver || !sender) return res.status(404).json({ message: "User not found" });

    // Add each other (avoid duplicates)
    if (!receiver.friends.includes(sender._id)) receiver.friends.push(sender._id);
    if (!sender.friends.includes(receiver._id)) sender.friends.push(receiver._id);

    await Promise.all([receiver.save(), sender.save()]);

    // notify both via socket (if any)
    const io = req.app.get("io");
    if (io) {
      io.to(receiverId.toString()).emit("friendListUpdated");
      io.to(senderId.toString()).emit("friendListUpdated");
      io.to(senderId.toString()).emit("friendRequestAccepted", {
        by: receiverId,
        requestId: request._id,
      });
    }

    // return the accepted friend (useful for frontend to add to list)
    const acceptedFriend = await User.findById(senderId).select("_id username email");
    res.json({ success: true, acceptedFriend });
  } catch (err) {
    console.error("Error accepting friend:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// List accepted friends for logged-in user
router.get("/list", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("friends", "_id username email");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.friends || []);
  } catch (err) {
    console.error("Error listing friends:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// List ALL users (dashboard) with a minimal status: not friend/pending/friend
// This is safe because we do not return other users' friend lists or sensitive data.
router.get("/all", protect, async (req, res) => {
  try {
    // get current user's friend ids and pending relations
    const me = await User.findById(req.user.id).select("friends");
    const pending = await FriendRequest.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: "pending",
    });

    const pendingMap = new Map();
    pending.forEach((p) => {
      // mark pending with direction
      if (String(p.requester) === String(req.user.id)) pendingMap.set(String(p.recipient), "sent");
      else if (String(p.recipient) === String(req.user.id)) pendingMap.set(String(p.requester), "received");
    });

    // fetch all users except me
    const users = await User.find({ _id: { $ne: req.user.id } }).select("_id username email");

    const enriched = users.map((u) => {
      const id = String(u._id);
      let status = "none";
      if (me.friends.some((f) => String(f) === id)) status = "friend";
      else if (pendingMap.has(id)) status = pendingMap.get(id); // 'sent' | 'received'
      return { _id: u._id, username: u.username, email: u.email, status };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Error /all:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
