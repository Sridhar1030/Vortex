import { Router } from "express";
import { createDeployment } from "../controller/deployment.controller.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

const router = Router();

router.post("/", verifyJWT, createDeployment);

export default router;
