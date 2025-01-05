import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app.js";
import mongoose from "mongoose";
import {Kafka} from "kafkajs"
import cors from "cors"
import { ClickHouseClient,createClient } from "@clickhouse/client";
import { v4 as uuidv4 } from "uuid"
import fs from "fs"
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

const kafka = new Kafka({
	clientId: `api-server`,
	brokers: ['kafka-384b4ddd-vortex121.i.aivencloud.com:28414'],
	ssl:{
		ca: [fs.readFileSync('./kafka.pem', 'utf-8')]
	},
	sasl:{
		username: 'avnadmin',
		password: 'AVNS_hUedNqcAkK1El6NBaEz',
		mechanism: 'plain'
	}
});


const client = createClient({
	host : "https://clickhouse-236e7d15-vortex121.i.aivencloud.com:28402",
	database : "default",
	username : "avnadmin",
	password : "AVNS_pZkQerdVmnQnl7yPiHt",
})

const consumer = kafka.consumer({ groupId: `api-server-logs-consumer` });
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


async function initKafkaConsumer() {
	await consumer.connect();
	await consumer.subscribe({ topic: 'container-logs' });
	
	await consumer.run({
		autoCommit: false,
		eachBatch: async ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary }) => {
			try {
				for (const message of batch.messages) {
					console.log(`Recv. ${message.length} messages..`)

					const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(message.value.toString());
					console.log({ log, DEPLOYEMENT_ID })

					// Insert single row at a time
					await client.insert({
						table: "log_events",
						values: [{
							event_id: uuidv4(),
							deployment_id: DEPLOYMENT_ID,
							project_id: PROJECT_ID,
							log: log,
							timestamp: new Date().toISOString()
						}],
						format: 'JSONEachRow'
					});

					// Mark message as processed
					resolveOffset(message.offset);
					await commitOffsetsIfNecessary(message.offset);
					await heartbeat();
				}
			} catch (error) {
				console.error('Error processing message:', error);
				// Don't rethrow to prevent consumer crash
			}
		}
	});
}

// Add error handling
consumer.on('consumer.crash', async (error) => {
	console.error('Consumer crashed:', error);
	// Optionally restart the consumer
	try {
		await initKafkaConsumer();
	} catch (e) {
		console.error('Failed to restart consumer:', e);
	}
});

// Initialize
initKafkaConsumer().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
	try {
		await consumer.disconnect();
	} catch (error) {
		console.error('Error during shutdown:', error);
	}
	process.exit(0);
});

// Start Express API server
app.get("/logs/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const result = await client.query({
			query: `SELECT event_id, log, deployment_id, timestamp FROM log_events WHERE deployment_id = '${id}'`,
			format: 'JSONEachRow'
		});

		// Get the rows as an array and parse them
		const rows = await result.json();
		
		res.json({
			status: 'success',
			data: rows
		});
	} catch (error) {
		console.error('Error fetching logs:', error);
		res.status(500).json({
			status: 'error',
			message: 'Failed to fetch logs'
		});
	}
});

app.listen(port, () => {
	console.log(`API server is running on port ${port}`);
});
