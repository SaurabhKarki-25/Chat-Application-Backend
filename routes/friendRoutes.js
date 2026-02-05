import express from "express";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ===========================
   SEND FRIEND REQUEST
=========================== */
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

    if (existing) {
      return res.status(400).json({ message: "Request already pending" });
    }

    // Already friends check
    const alreadyFriends = await User.exists({
      _id: requesterId,
      friends: recipientId,
    });

    if (alreadyFriends) {
      return res.status(400).json({ message: "Already friends" });
    }

    const newRequest = await FriendRequest.create({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
    });

    // notify recipient via socket
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

/* ===========================
   INCOMING REQUESTS (Received by me)
=========================== */
router.get("/pending/received", protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    })
      .populate("requester", "username email")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Error fetching received requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   SENT REQUESTS (Sent by me)
=========================== */
router.get("/pending/sent", protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      requester: req.user.id,
      status: "pending",
    })
      .populate("recipient", "username email")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Error fetching sent requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   ACCEPT FRIEND REQUEST
=========================== */
router.put("/accept/:id", protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (String(request.recipient) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (request.status === "accepted") {
      return res.status(400).json({ message: "Request already accepted" });
    }

    request.status = "accepted";
    await request.save();

    const receiverId = req.user.id; // recipient (accepted)
    const senderId = request.requester; // requester (sent)

    const [receiver, sender] = await Promise.all([
      User.findById(receiverId),
      User.findById(senderId),
    ]);

    if (!receiver || !sender) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add each other as friends
    if (!receiver.friends.includes(sender._id)) receiver.friends.push(sender._id);
    if (!sender.friends.includes(receiver._id)) sender.friends.push(receiver._id);

    await Promise.all([receiver.save(), sender.save()]);

    // notify both via socket
    const io = req.app.get("io");
    if (io) {
      io.to(receiverId.toString()).emit("friendListUpdated");
      io.to(senderId.toString()).emit("friendListUpdated");
      io.to(senderId.toString()).emit("friendRequestAccepted", {
        by: receiverId,
        requestId: request._id,
      });
    }

    const acceptedFriend = await User.findById(senderId).select(
      "_id username email"
    );

    res.json({ success: true, acceptedFriend });
  } catch (err) {
    console.error("Error accepting friend:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   FRIEND LIST (My friends)
=========================== */
router.get("/list", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate(
      "friends",
      "_id username email"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user.friends || []);
  } catch (err) {
    console.error("Error listing friends:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   ACCEPTED REQUESTS LIST (History)
=========================== */
router.get("/accepted", protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: "accepted",
    })
      .populate("requester", "username email")
      .populate("recipient", "username email")
      .sort({ updatedAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Error fetching accepted requests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   ALL USERS (NO STATUS)
=========================== */
router.get("/all", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select(
      "_id username email"
    );

    res.json(users);
  } catch (err) {
    console.error("Error /all:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
