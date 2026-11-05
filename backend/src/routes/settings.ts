import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";

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
  const { allowPublicRegistration, requireAdminApproval, defaultMemberRole, publicClientSlugs } = req.body;

  const updated = db.updateSettings({
    allowPublicRegistration: typeof allowPublicRegistration === "boolean" ? allowPublicRegistration : undefined,
    requireAdminApproval: typeof requireAdminApproval === "boolean" ? requireAdminApproval : undefined,
    defaultMemberRole: defaultMemberRole || undefined,
    publicClientSlugs: Array.isArray(publicClientSlugs) ? publicClientSlugs : undefined,
  });

  db.addAuditLog({
    event: "SETTINGS_UPDATED",
    userEmail: req.user?.email || "admin",
    ipAddress: getClientIp(req),
    status: "info",
    details: `Updated AuthHub global configuration settings`,
  });

  res.json({ settings: updated });
});
