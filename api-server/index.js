import { Server } from "socket.io";
import Redis from "ioredis";
import dotenv from "dotenv";
import app from "./app.js";
import mongoose from "mongoose";

// Load environment variables
dotenv.config();

const port = 9000;

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
	.then(() => console.log("Connected to MongoDB"))
	.catch((err) => console.error("MongoDB connection error:", err));

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
	console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
	console.log("MongoDB disconnected");
});

// Redis Client
const redisUrl = process.env.REDIS_URL || "rediss://default:AVNS_S_UHSuVMWrPySBVXopU@caching-24643986-vortex121.i.aivencloud.com:28402";
const subscriber = new Redis(redisUrl);

// Socket.IO server setup
const io = new Server({ cors: { origin: "*" } });
io.listen(9001, () => {
	console.log("Socket server is running on port 9001");
});

// Handle client connections and subscription to channels
io.on("connection", (socket) => {
	console.log("Client connected", socket.id);

	socket.on("subscribe", (channel) => {
		socket.join(channel);
		socket.emit("subscribe", `Joined ${channel}`);
	});
});

// Function to initialize Redis subscription to 'logs' channels
async function initRedisSubscriber() {
	console.log("Subscribing to Redis channels (logs:*)...");
	subscriber.psubscribe("logs:*");

	subscriber.on("pmessage", (pattern, channel, message) => {
		console.log("Received message:", { pattern, channel, message });

		try {
			const parsedMessage = JSON.parse(message);
			io.to(channel).emit("message", parsedMessage);
		} catch (error) {
			console.error("Error parsing message:", error);
		}
	});

	subscriber.on("connect", () => {
		console.log("Connected to Redis!");
	});

	subscriber.on("error", (error) => {
		console.error("Redis connection error:", error);
	});
}

initRedisSubscriber();

// Start Express API server
app.listen(port, () => {
	console.log(`API server is running on port ${port}`);
});
