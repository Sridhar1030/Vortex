//id name gitURL subDomian customDomain
import { Schema, model } from "mongoose";

const projectSchema = new Schema(
	{
		name: { type: String, required: true },
		createdBy: { type: Schema.Types.ObjectId, ref: "User" },
		gitUrl: { type: String, required: true },
		subDomain: { type: String, required: true },
		customDomain: { type: String, required: false },
		deployments: [{ type: Schema.Types.ObjectId, ref: "Deployment" }],
	},
	{ timestamps: true }
);

export const Project = model("Project", projectSchema);
