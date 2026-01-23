import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import uploadRoutes from "./routes/uploadRoutes.js";


// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutws.js";
import friendRoutes from "./routes/friendRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import aiRoutes from "./routes/aiRoutes.js"; // 🤖 REST AI

dotenv.config();
connectDB();

const app = express();

/* ======================= MIDDLEWARE ======================= */
app.use(
  cors({
    origin: ["http://localhost:5173","https://chat-application-frontend-ruby.vercel.app"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));

/* ======================= ROUTES ======================= */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes); // 🤖 AI REST ROUTE

/* ======================= SERVER ======================= */
const server = http.createServer(app);

/* ======================= SOCKET.IO ======================= */
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
  pingTimeout: 60000,
});

app.set("io", io);

/* ======================= ONLINE USERS ======================= */
const onlineUsers = new Map();

/* ======================= SOCKET EVENTS ======================= */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  /* JOIN */
  socket.on("join", (userId) => {
    if (!userId) return;
    onlineUsers.set(String(userId), socket.id);
    socket.join(String(userId));
  });

  /* 👤 HUMAN → HUMAN MESSAGE */
  socket.on("sendMessage", ({ senderId, senderName, receiverId, text }) => {
    if (!receiverId || !text) return;

    const receiverSocketId = onlineUsers.get(String(receiverId));
    if (!receiverSocketId) return;

    io.to(receiverSocketId).emit("receiveMessage", {
      senderId,
      senderName,
      text,
      timestamp: new Date(),
    });
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ======================= START SERVER ======================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
