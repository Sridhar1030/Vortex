import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Kafka } from "kafkajs";
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
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

const kafka = new Kafka({
	clientId: `docker-build-server-${DEPLOYMENT_ID}`,
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

const producer = kafka.producer();


async function publishLog(log) {
    await producer.send({ topic: `container-logs`, messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log }) }] })
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
	await producer.connect();
	console.log("Executing script.js");
	await publishLog("Build started");

	const outDirPath = path.join("/home/app/output");

	try {
		await publishLog("Initializing S3 client");
		const s3Client = initS3Client();

		await publishLog("Installing dependencies and building project");
		await execPromise(`cd ${outDirPath} && npm install && npm run build`);
		await publishLog("Build completed successfully 🎉");

		const distFolderPath = path.join(outDirPath, "dist");

		if (!fs.existsSync(distFolderPath)) {
			await publishLog("Error: Dist folder not found");
			console.error("Dist folder does not exist:", distFolderPath);
			process.exit(1);
		}

		await publishLog("Starting file upload to S3");
		const distFolderContents = getAllFiles(distFolderPath);
		await publishLog(`Found ${distFolderContents.length} files to upload`);

		// Upload each file to S3
		for (const file of distFolderContents) {
			const filePath = file;
			if (fs.lstatSync(filePath).isDirectory()) {
				continue;
			}

			const relativeFilePath = path.relative(distFolderPath, filePath);
			await publishLog(`Uploading: ${relativeFilePath}`);

			const command = new PutObjectCommand({
				Bucket: "vortex-vercel-clone",
				Key: `__outputs/${PROJECT_ID}/${relativeFilePath}`,
				Body: fs.createReadStream(filePath),
				ContentType: mime.lookup(filePath) || 'application/octet-stream',
			});

			try {
				await s3Client.send(command);
				await publishLog(`Successfully uploaded: ${relativeFilePath}`);
			} catch (error) {
				await publishLog(`Error uploading ${relativeFilePath}: ${error.message}`);
				console.error(`Failed to upload ${relativeFilePath}:`, error.message);
				throw error;
			}
		}

		await publishLog("🎉 All files uploaded successfully!");
		//exit after 1 min
		setTimeout(() => {		
			process.exit(0);
		}, 15000);
	} catch (error) {
		await publishLog(`Fatal error: ${error.message}`);
		console.error("Fatal error during build/upload process:", error);
		process.exit(1);
	}
};

// Start the process
init();
