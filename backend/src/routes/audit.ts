import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.use(authMiddleware);
auditRouter.use(requireAdmin);

/**
 * GET /api/audit-logs
 * Retrieve latest security audit trail
 */
auditRouter.get("/", (_req: AuthRequest, res: Response) => {
  res.json({ auditLogs: db.getAuditLogs() });
});
