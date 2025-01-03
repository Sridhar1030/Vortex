import express from "express";
import { generateSlug } from "random-word-slugs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = 9000;

app.use(express.json());

const ecsClient = new ECSClient({
	region: "ap-south-1",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	},
});

const config = {
    CLUSTER:'arn:aws:ecs:ap-south-1:615299759000:cluster/builder-cluster-vercel',
    Task:'arn:aws:ecs:ap-south-1:615299759000:task-definition/builder-task'
}
app.post("/project", async (req, res) => {
	const { gitUrl } = req.body;
	const projectSlug = generateSlug();
	//spin the container
	const command = new RunTaskCommand({
		cluster: config.CLUSTER,
		taskDefinition: config.Task,
		launchType: "FARGATE",
		count: 1,
		networkConfiguration: {
			awsvpcConfiguration: {
				assignPublicIp: "ENABLED",
				securityGroups: ['sg-01ab853654ef8b8fd'],
				subnets: ['subnet-08808531b9c18f47b','subnet-0cfae3a7e1e792f97','subnet-0bdab3ca05a7fa826'],
			},
		},
        overrides:{
            containerOverrides:[
                {
					name: "builder-image",
					environment: [
						{ name: "PROJECT_ID", value: projectSlug },
						{ name: "GIT_REPOSITORY__URL", value: gitUrl },
					],
				},
			],
        }
	});
    await ecsClient.send(command);

	return res.json({ status: "queued", data: { projectSlug }, url: `http://${projectSlug}.localhost:8000` });
});
app.listen(port, () => {
	console.log(`Api server is running on port ${port}`);
});
