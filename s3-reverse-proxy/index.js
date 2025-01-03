import express from "express";
import httpProxy from "http-proxy";
const app = express();
const port = 8000;
const Base_Path = "https://vortex-vercel-clone.s3.ap-south-1.amazonaws.com/__outputs";

const proxy = httpProxy.createProxy();
app.use((req, res) => {
	const host = req.hostname;
	const subdomain = host.split(".")[0];
	

	const resolveTo = `${Base_Path}/${subdomain}`;
	proxy.web(req, res, { target: resolveTo, changeOrigin: true });
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
