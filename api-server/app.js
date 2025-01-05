import express from "express";
import { generateSlug } from "random-word-slugs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import dotenv from "dotenv";
import { ClickHouseClient } from "@clickhouse/client";
import cors from "cors"


// Load environment variables
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors())
// AWS ECS Client
const ecsClient = new ECSClient({
	region: "ap-south-1",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

const config = {
	CLUSTER:
		"arn:aws:ecs:ap-south-1:615299759000:cluster/builder-cluster-vercel",
	Task: "arn:aws:ecs:ap-south-1:615299759000:task-definition/builder-task",
};

import projectRoutes from "./routes/project.routes.js";
import deploymentRoutes from "./routes/deployment.routes.js";
import authRoutes from "./routes/user.routes.js";


app.use('/api/auth', authRoutes);

app.use("/api/project", projectRoutes);
app.use("/api/deployment", deploymentRoutes);


export default app;
