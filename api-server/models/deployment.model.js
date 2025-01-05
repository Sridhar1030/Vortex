//projectId, status, createdAt, updatedAt
import { Schema, model } from "mongoose";

const deploymentSchema = new Schema(
	{
		project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
		status: {
			type: String,
			required: true,
			enum: ["QUEUED", "BUILDING", "FAILED", "READY"],
			default: "QUEUED"
		},
	},
	{ timestamps: true }
);

export const Deployment = model("Deployment", deploymentSchema);
