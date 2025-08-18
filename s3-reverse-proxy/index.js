import express from "express";
import httpProxy from "http-proxy";
import mongoose from "mongoose";

// Add mongoose schema and model
const projectSchema = new mongoose.Schema(
	{
		name: { type: String, required: true },
		gitUrl: { type: String, required: true },
		subDomain: { type: String, required: true },
		customDomain: { type: String, required: false },
	},
	{ timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);

const app = express();
const port = 8000;
const Base_Path = "https://vortex-vercel-clone.s3.ap-south-1.amazonaws.com/__outputs";

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/vortex')
	.then(() => console.log('Connected to MongoDB'))
	.catch(err => console.error('MongoDB connection error:', err));

const proxy = httpProxy.createProxy();

// Update the middleware to use async/await for MongoDB query
app.use(async (req, res) => {
	try {
		const host = req.hostname;
		const subdomain = host.split(".")[0];


		// Find project in MongoDB
		const project = await Project.findOne({ subDomain: subdomain });
		
		if (!project) {
			return res.status(404).send('Project not found');
		}

		const resolveTo = `${Base_Path}/${project._id}`;
		proxy.web(req, res, { target: resolveTo, changeOrigin: true });
	} catch (error) {
		console.error('Error:', error);
		res.status(500).send('Internal Server Error');
	}
});

proxy.on("proxyReq", (proxyReq, req, res) => {
	const url = req.url;
	if (url === "/") {
		proxyReq.path += "index.html";
	}
	return proxyReq
});

app.listen(port, () => {
	console.log(`Reverse proxy server is running on port ${port}`);
});
