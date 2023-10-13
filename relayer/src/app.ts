import { createServer } from "http";
import express from "express";
import config from "config";
import cors from "cors";
import { log } from "@/utils/logger";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.set("trust proxy", 1);
app.use(cors());

const port = config.get<number>("port");
const host = config.get<string>("host");

console.log("✨ Relayer v1");

httpServer.listen(port, host, async () => {
  log.info(`🚀 Server listening on port ${port}`);
});
