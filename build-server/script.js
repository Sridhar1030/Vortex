import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Redis from "ioredis";




const publisher = new Redis('rediss://default:AVNS_S_UHSuVMWrPySBVXopU@caching-24643986-vortex121.i.aivencloud.com:28402')

import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize AWS S3 client with credential verification
const initS3Client = () => {
	if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
		throw new Error('AWS credentials are not properly configured');
	}
	
	return new S3Client({
		region: "ap-south-1",
		credentials: {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		},
	});
};

// Get project ID from environment variable
const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
	publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({log}));
}
// Helper function to recursively get all files in a directory
const getAllFiles = (dirPath) => {
	let results = [];
	const list = fs.readdirSync(dirPath);
	list.forEach((file) => {
		const filePath = path.join(dirPath, file);
		const stat = fs.lstatSync(filePath);
		if (stat.isDirectory()) {
			results = results.concat(getAllFiles(filePath)); // Recurse into subdirectory
		} else {
			results.push(filePath); // Add file to results
		}
	});
	return results;
};

// Helper function to execute shell commands as a promise
const execPromise = (command) => {
	return new Promise((resolve, reject) => {
		const p = exec(command);
		p.stdout.on("data", (data) => console.log(data.toString()));
		p.stderr.on("data", (data) => console.error("Error:", data.toString()));
		p.on("close", (code) => {
			if (code === 0) {
				resolve(code);
				console.log("Process exited with code " ,code);
				
			} else {
				console.error(`Process exited with code ${code}`);
				process.exit(code); // Exit with the same code as the child process
			}
		});
		p.on("error", reject);
	});
};

// Main function to handle the build and file upload process
const init = async () => {
	console.log("Executing script.js");
	publishLog("Build started");

	const outDirPath = path.join("/home/app/output");

	try {
		publishLog("Initializing S3 client");
		const s3Client = initS3Client();

		publishLog("Installing dependencies and building project");
		await execPromise(`cd ${outDirPath} && npm install && npm run build`);
		publishLog("Build completed successfully 🎉");

		const distFolderPath = path.join(outDirPath, "dist");

		if (!fs.existsSync(distFolderPath)) {
			publishLog("Error: Dist folder not found");
			console.error("Dist folder does not exist:", distFolderPath);
			process.exit(1);
		}

		publishLog("Starting file upload to S3");
		const distFolderContents = getAllFiles(distFolderPath);
		publishLog(`Found ${distFolderContents.length} files to upload`);

		// Upload each file to S3
		for (const file of distFolderContents) {
			const filePath = file;
			if (fs.lstatSync(filePath).isDirectory()) {
				continue;
			}

			const relativeFilePath = path.relative(distFolderPath, filePath);
			publishLog(`Uploading: ${relativeFilePath}`);

			const command = new PutObjectCommand({
				Bucket: "vortex-vercel-clone",
				Key: `__outputs/${PROJECT_ID}/${relativeFilePath}`,
				Body: fs.createReadStream(filePath),
				ContentType: mime.lookup(filePath) || 'application/octet-stream',
			});

			try {
				await s3Client.send(command);
				publishLog(`Successfully uploaded: ${relativeFilePath}`);
			} catch (error) {
				publishLog(`Error uploading ${relativeFilePath}: ${error.message}`);
				console.error(`Failed to upload ${relativeFilePath}:`, error.message);
				throw error;
			}
		}

		publishLog("🎉 All files uploaded successfully!");
		//exit after 1 min
		setTimeout(() => {		
			process.exit(0);
		}, 60000);
	} catch (error) {
		publishLog(`Fatal error: ${error.message}`);
		console.error("Fatal error during build/upload process:", error);
		process.exit(1);
	}
};

// Start the process
init();
