import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutws.js";
import friendRoutes from "./routes/friendRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

dotenv.config();
connectDB();

const app = express();

/* ======================= CORS FIX ======================= */

const allowedOrigins = [
  "http://localhost:5173",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / server-to-server

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") // ✅ allow ALL vercel deployments
    ) {
      return callback(null, true);
    }

    return callback(new Error("CORS blocked: " + origin));
  },
  credentials: true,
};

app.use(cors(corsOptions));

/* ======================= MIDDLEWARE ======================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ======================= HEALTH CHECK ======================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 Backend is running fine!",
  });
});

/* ======================= ROUTES ======================= */

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);

/* ======================= ERROR HANDLER ======================= */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

/* ======================= SERVER ======================= */

const server = http.createServer(app);

/* ======================= SOCKET.IO ======================= */

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (
        origin.endsWith(".vercel.app") ||
        origin === "http://localhost:5173"
      ) {
        return callback(null, true);
      }

      return callback("Socket CORS blocked");
    },
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

  socket.on("join", (userId) => {
    if (!userId) return;

    const uid = String(userId);
    onlineUsers.set(uid, socket.id);
    socket.join(uid);

    console.log(`✅ User joined: ${uid}`);
  });

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

  socket.on("disconnect", () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        console.log(`❌ User offline: ${uid}`);
        break;
      }
    }

    console.log("❌ Socket disconnected:", socket.id);
  });
});

/* ======================= START SERVER ======================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
