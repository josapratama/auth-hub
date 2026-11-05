import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";
import { notifyBackchannelLogout } from "../utils/logoutWebhook.js";
import { sendNotificationEmail } from "../utils/mailer.js";

export const sessionsRouter = Router();

sessionsRouter.use(authMiddleware);
sessionsRouter.use(requireAdmin);

/**
 * GET /api/sessions
 * List all active sessions with device & location telemetry
 */
sessionsRouter.get("/", (_req: AuthRequest, res: Response) => {
  const allSessions = db.getSessions();
  const now = new Date().toISOString();
  const activeSessions = allSessions.filter(
    (s) => !s.revoked && s.expiresAt > now
  );
  res.json({ sessions: activeSessions, totalTracked: allSessions.length });
});

/**
 * POST /api/sessions/revoke
 * Revoke a single session + Dispatch backchannel logout webhook + Email notification
 */
sessionsRouter.post("/revoke", async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const session = db.getSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  db.revokeSession(sessionId);

  // Dispatch backchannel logout webhook asynchronously
  notifyBackchannelLogout(session).catch(() => {});

  // Send security email
  sendNotificationEmail({
    to: session.userEmail,
    subject: "Pemberitahuan Keamanan: Sesi Login Dicabut (Revoked)",
    category: "notifySessionRevoked",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #f43f5e; margin-top: 0;">⚠️ Sesi Login Dicabut</h2>
        <p>Halo <strong>${session.userName}</strong>,</p>
        <p>Sesi login Anda di aplikasi <strong>${session.clientName}</strong> telah dicabut oleh Administrator:</p>
        <ul style="color: #cbd5e1; line-height: 1.8;">
          <li><strong>ID Sesi:</strong> <code>${session.id}</code></li>
          <li><strong>Waktu Dicabut:</strong> ${new Date().toLocaleString('id-ID')}</li>
        </ul>
        <p>Jika Anda sedang membuka aplikasi tersebut, Anda akan diminta untuk masuk kembali.</p>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b;">Pemberitahuan otomatis dari AuthHub Security Manager.</p>
      </div>
    `,
  }).catch(() => {});

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
sessionsRouter.post("/killswitch-app", async (req: AuthRequest, res: Response) => {
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
      notifyBackchannelLogout(s).catch(() => {});
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
sessionsRouter.post("/killswitch-all", async (req: AuthRequest, res: Response) => {
  const all = db.getSessions();
  let count = 0;
  for (const s of all) {
    if (!s.revoked && s.id !== req.user?.sid) {
      s.revoked = true;
      count++;
      notifyBackchannelLogout(s).catch(() => {});
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
