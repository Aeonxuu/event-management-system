import * as dotenv from "dotenv";
import path from "path";

// Load .env.local first, before any other imports that might use env variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

import { connectToDatabase } from "../lib/db";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import eventsRoutes from "./routes/events";
import venuesRoutes from "./routes/venues";
import adminRoutes from "./routes/admin";
import queuesRoutes from "./routes/queues";
import organizationsRoutes from "./routes/organizations";
import venueByIdRoutes from "./routes/venueById";
import meRoutes from "./routes/me";
import adminEventsRoutes from "./routes/adminEvents";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(
  cors({ origin: process.env.APP_URL || "http://localhost:3000", credentials: true }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/venues", venuesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/queues", queuesRoutes);
app.use("/api/organizations", organizationsRoutes);
app.use("/api/venues", venuesRoutes);
app.use("/api/venues", venueByIdRoutes);
app.use("/api/me", meRoutes);
app.use("/api/admin", adminEventsRoutes);

// Serve client static build if present
import path from "path";
const clientDist = path.resolve(process.cwd(), "dist/client");
import fs from "fs";
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("/", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  app.get("/*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// Error handler (last)
app.use(errorHandler);

const PORT = Number(process.env.EXPRESS_PORT || 3001);

connectToDatabase()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Express server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to database:", err);
    process.exit(1);
  });
