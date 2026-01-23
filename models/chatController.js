const { text, type, fileUrl, fileName } = req.body;

chat.messages.push({
  senderId: req.user._id,
  senderName: req.user.username,
  type: type || "text",
  text,
  fileUrl,
  fileName,
  timestamp: new Date(),
});

chat.lastUpdated = new Date();
await chat.save();
