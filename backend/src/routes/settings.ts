import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";
import { sendNotificationEmail } from "../utils/mailer.js";

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);
settingsRouter.use(requireAdmin);

/**
 * GET /api/settings
 * Fetch global AuthHub settings
 */
settingsRouter.get("/", (_req: AuthRequest, res: Response) => {
  res.json({ settings: db.getSettings() });
});

/**
 * POST /api/settings
 * Update global AuthHub settings
 */
settingsRouter.post("/", (req: AuthRequest, res: Response) => {
  const {
    allowPublicRegistration,
    requireAdminApproval,
    defaultMemberRole,
    publicClientSlugs,
    emailNotifications,
  } = req.body;

  const updated = db.updateSettings({
    allowPublicRegistration: typeof allowPublicRegistration === "boolean" ? allowPublicRegistration : undefined,
    requireAdminApproval: typeof requireAdminApproval === "boolean" ? requireAdminApproval : undefined,
    defaultMemberRole: defaultMemberRole || undefined,
    publicClientSlugs: Array.isArray(publicClientSlugs) ? publicClientSlugs : undefined,
    emailNotifications: emailNotifications ? emailNotifications : undefined,
  });

  db.addAuditLog({
    event: "SETTINGS_UPDATED",
    userEmail: req.user?.email || "admin",
    ipAddress: getClientIp(req),
    status: "info",
    details: `Updated AuthHub global configuration settings & email notification policies`,
  });

  res.json({ settings: updated });
});

/**
 * POST /api/settings/test-email
 * Send a verification test email using currently configured SMTP
 */
settingsRouter.post("/test-email", async (req: AuthRequest, res: Response) => {
  const adminEmail = req.user?.email || "admin@josapratama.com";

  const result = await sendNotificationEmail({
    to: adminEmail,
    subject: "Uji Coba Pengiriman Email AuthHub",
    category: "notifyPasswordReset", // test under master toggle
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #10b981; margin-top: 0;">🎉 Uji Coba Email Berhasil</h2>
        <p>Halo Administrator,</p>
        <p>Koneksi SMTP dan konfigurasi notifikasi email AuthHub Anda berfungsi dengan baik.</p>
        <p>Waktu pengujian: <strong>${new Date().toLocaleString('id-ID')}</strong></p>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b;">AuthHub Email Notification Engine</p>
      </div>
    `,
  });

  res.json(result);
});
