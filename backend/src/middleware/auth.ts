import type { Request, Response, NextFunction } from "express";
import { verifyJwt, type JwtPayload } from "../crypto.js";
import { db } from "../db.js";

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header (Bearer token required)" });
  }

  const token = authHeader.split(" ")[1];
  const verified = verifyJwt(token);

  if (!verified.valid || !verified.payload) {
    return res.status(401).json({ error: verified.error || "Invalid or expired token" });
  }

  // Check if session was revoked in db
  if (verified.payload.sid) {
    const session = db.getSessionById(verified.payload.sid);
    if (!session || session.revoked) {
      return res.status(401).json({ error: "Session has been revoked or expired" });
    }
  }

  req.user = verified.payload;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.globalRole !== "superadmin" && req.user.globalRole !== "admin")) {
    return res.status(403).json({ error: "Access denied: Requires administrator privilege" });
  }
  next();
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.globalRole !== "superadmin") {
    return res.status(403).json({ error: "Access denied: Requires superadmin privilege" });
  }
  next();
}
