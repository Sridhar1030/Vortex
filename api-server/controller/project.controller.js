import { z } from "zod";
import { Project } from "../models/project.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const generateSlug = () => {
	return Math.random().toString(36).substring(2, 15);
};

export const createProject = asyncHandler(async (req, res) => {
	const schema = z.object({
		name: z.string().min(3).max(20),
		gitUrl: z.string().url(),
		slug: z.string().optional(),
	});

	const safeParsedResult = schema.safeParse(req.body);

	if (!safeParsedResult.success) {
		return res.status(400).json({
			error: safeParsedResult.error.message,
			details: safeParsedResult.error.errors,
		});
	}

	const { name, gitUrl, slug } = safeParsedResult.data;
	const generatedSlug = slug || generateSlug();

	try {
		const existingProject = await Project.findOne({
			owner: req.user._id,
			gitUrl,
		});

		if (existingProject) {
			return res.status(400).json({ error: "Project already exists" });
		}

		const project = await Project.create({
			name,
			gitUrl,
			subDomain: generatedSlug,
			owner: req.user._id,
		});

		return res.json({
			status: "success",
			data: { project },
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ error: "Internal server error" });
	}
});
