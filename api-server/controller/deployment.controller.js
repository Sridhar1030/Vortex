import { Deployment } from "../models/deployment.model.js";
import { Project } from "../models/project.model.js";
import { startDeployment } from "../services/ecs.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const createDeployment = asyncHandler(async  (req, res) => {
	const { projectId } = req.body;
	const userId = req.user._id;

	try {
		const project = await Project.findOne({ _id: projectId });

		if (!project) {
			return res.status(404).json({ error: "Project not found" });
		}

		// Check for existing running deployment
		const existingDeployment = await Deployment.findOne({
			project: projectId,
			status: "BUILDING"
		});

		if (existingDeployment) {
			return res.status(400).json({ 
				error: "A deployment is already in progress for this project" 
			});
		}

		const deployment = await Deployment.create({
			project: projectId,
			status: "QUEUED",
		});

		project.deployments.push(deployment._id);
		await project.save();

		await startDeployment(project, deployment);
		
		deployment.status = "READY";
		await deployment.save();

		return res.status(201).json({ 
			message: "Deployment created", 
			data: { deploymentId: deployment._id } 
		});
	} catch (error) {
		console.error('Deployment creation failed:', error);
		return res.status(500).json({ 
			error: "Failed to create deployment",
			details: error.message 
		});
	}
});
