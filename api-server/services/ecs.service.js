import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import dotenv from "dotenv";

dotenv.config();

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

export const startDeployment = async (project, deployment) => {
    // console.log("startDeployment", project, deployment)
	try {
		const command = new RunTaskCommand({
			cluster: config.CLUSTER,
			taskDefinition: config.Task,
			launchType: "FARGATE",
			count: 1,
			networkConfiguration: {
				awsvpcConfiguration: {
					assignPublicIp: "ENABLED",
					securityGroups: ["sg-01ab853654ef8b8fd"],
					subnets: [
						"subnet-08808531b9c18f47b",
						"subnet-0cfae3a7e1e792f97",
						"subnet-0bdab3ca05a7fa826",
					],
				},
			},
			overrides: {
				containerOverrides: [
					{
						name: "builder-image",
						environment: [
							{
								name: "PROJECT_ID",
								value: project._id.toString(),
							},
							{
								name: "GIT_REPOSITORY__URL",
								value: project.gitUrl,
							},
							{
								name: "DEPLOYMENT_ID",
								value: deployment._id.toString(),
							},
						],
					},
				],
			},
		});

		const { tasks } = await ecsClient.send(command);

		if (!tasks || tasks.length === 0) {
			throw new Error("ECS task creation failed - no tasks returned");
		}

		return tasks[0];
	} catch (error) {
		console.error('ECS Task creation failed:', error);
		throw new Error(`Failed to start ECS task: ${error.message}`);
	}
};
