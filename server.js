import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// import routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutws.js";
import friendRoutes from "./routes/friendRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();
connectDB();

const app = express();

const cors = require("cors");

const allowedOrigins = [
  "https://chat-application-frontend-indy.vercel.app",
  "https://chat-application-frontend-iss4.vercel.app",
  "https://chat-application-frontend-1545.vercel.app",
   "https://chat-application-frontend-ruby.vercel.app",
    "https://chat-application-frontend-1s54.vercel.app", // ✅ add this too
  "http://localhost:3000" // ✅ for local dev
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));


app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/chats", chatRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
});

// store io on app so routes can access it via req.app.get("io")
app.set("io", io);

const onlineUsers = new Map();

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    if (!userId) return;
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
  });

  socket.on("sendMessage", ({ senderId, receiverId, message, timestamp }) => {
    const receiverSocketId = onlineUsers.get(String(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", {
        senderId,
        message,
        timestamp: timestamp || new Date(),
      });
    }
    // else offline — chat route already persists message in DB
  });

  socket.on("disconnect", () => {
    // remove user from onlineUsers (find by socket id)
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
