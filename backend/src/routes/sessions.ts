import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";

export const sessionsRouter = Router();

sessionsRouter.use(authMiddleware);
sessionsRouter.use(requireAdmin);

/**
 * GET /api/sessions
 * List all active sessions
 */
sessionsRouter.get("/", (_req: AuthRequest, res: Response) => {
  const allSessions = db.getSessions();
  const now = new Date().toISOString();
  // Mark expired or revoked
  const activeSessions = allSessions.filter(
    (s) => !s.revoked && s.expiresAt > now
  );
  res.json({ sessions: activeSessions, totalTracked: allSessions.length });
});

/**
 * POST /api/sessions/revoke
 * Revoke a single session
 */
sessionsRouter.post("/revoke", (req: AuthRequest, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  db.revokeSession(sessionId);

  db.addAuditLog({
    event: "SESSION_REVOKED",
    userEmail: session.userEmail,
    clientSlug: session.clientSlug,
    ipAddress: getClientIp(req),
    status: "warning",
    details: `Session ${sessionId} manually revoked by Admin ${req.user?.email}`,
  });

  res.json({ success: true, message: `Session ${sessionId} revoked` });
});

/**
 * POST /api/sessions/killswitch-app
 * Terminate all sessions for a specific client application
 */
sessionsRouter.post("/killswitch-app", (req: AuthRequest, res: Response) => {
  const { clientSlug } = req.body;
  if (!clientSlug) {
    return res.status(400).json({ error: "clientSlug is required" });
  }

  const all = db.getSessions();
  let count = 0;
  for (const s of all) {
    if (s.clientSlug === clientSlug && !s.revoked) {
      s.revoked = true;
      count++;
    }
  }
  db.save();

  db.addAuditLog({
    event: "SESSION_REVOKED",
    userEmail: req.user?.email || "admin",
    clientSlug,
    ipAddress: getClientIp(req),
    status: "danger",
    details: `GLOBAL KILL-SWITCH: Revoked ${count} active sessions for client application '${clientSlug}'`,
  });

  res.json({ success: true, revokedCount: count, message: `Revoked ${count} sessions for ${clientSlug}` });
});

/**
 * POST /api/sessions/killswitch-all
 * Global Emergency Kill-Switch: terminate all sessions across entire ecosystem
 */
sessionsRouter.post("/killswitch-all", (req: AuthRequest, res: Response) => {
  const all = db.getSessions();
  let count = 0;
  for (const s of all) {
    // Preserve current admin session if desired or revoke all
    if (!s.revoked && s.id !== req.user?.sid) {
      s.revoked = true;
      count++;
    }
  }
  db.save();

  db.addAuditLog({
    event: "SESSION_REVOKED",
    userEmail: req.user?.email || "admin",
    ipAddress: getClientIp(req),
    status: "danger",
    details: `EMERGENCY ECOSYSTEM KILL-SWITCH: Revoked ${count} active sessions across all applications`,
  });

  res.json({ success: true, revokedCount: count, message: `Emergency Kill-Switch executed. Revoked ${count} sessions.` });
});
