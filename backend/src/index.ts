import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { PORT, EXPECTED_ORIGIN } from "./config.js";
import { oauthRouter } from "./routes/oauth.js";
import { authRouter } from "./routes/auth.js";
import { webauthnRouter } from "./routes/webauthn.js";
import { clientsRouter } from "./routes/clients.js";
import { usersRouter } from "./routes/users.js";
import { sessionsRouter } from "./routes/sessions.js";
import { auditRouter } from "./routes/audit.js";
import { settingsRouter } from "./routes/settings.js";
import { simulationRouter } from "./routes/simulation.js";

const app = express();

// Trust proxy for VPS Nginx/Cloudflare reverse proxy IP forwarding
app.set("trust proxy", 1);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        EXPECTED_ORIGIN.includes(origin) ||
        origin.endsWith(".josapratama.com") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for universal SSO ecosystem
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AuthHub Identity & SSO Engine",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Routes
app.use(oauthRouter);
app.use(authRouter);
app.use("/api/webauthn", webauthnRouter);
app.use(webauthnRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/users", usersRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/audit-logs", auditRouter);
app.use("/api/settings", settingsRouter);
app.use("/api", simulationRouter);

// Serve static production frontend files if built
const frontendDistPath = path.resolve(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    // Avoid capturing api routes with index.html
    if (req.path.startsWith("/api") || req.path.startsWith("/oauth")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

// Global 404 Handler for API
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route '${req.method} ${req.path}' not found` });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("AuthHub Backend Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`🛡️ AuthHub SSO Engine running on http://localhost:${PORT}`);
  console.log(`📡 Standard OAuth2 Endpoint: http://localhost:${PORT}/oauth/authorize`);
  console.log(`🔐 YubiKey WebAuthn RP: ${process.env.RP_ID || "localhost"}`);
});

export default app;
