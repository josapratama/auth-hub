import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { db, AppRole } from "./db.js";
import {
  verifyPassword,
  signJwt,
  verifyJwt,
  generateTotpCode,
  verifyTotpCode,
} from "./crypto.js";

const app = express();
const PORT = process.env.PORT || 4100;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Serve built frontend if exists
const FRONTEND_DIST = path.resolve(process.cwd(), "../frontend/dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
}

function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return req.socket.remoteAddress || "127.0.0.1";
}

// ─── Brute-Force & Rate Limiting Shield ────────────────────────
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number;
}
const rateLimiter = new Map<string, RateLimitEntry>();

function isRateLimited(
  key: string,
  maxAttempts = 5,
  lockDurationMs = 15 * 60 * 1000
): { limited: boolean; remainingMs: number } {
  const now = Date.now();
  const entry = rateLimiter.get(key);
  if (!entry) return { limited: false, remainingMs: 0 };

  if (entry.lockedUntil > now) {
    return { limited: true, remainingMs: entry.lockedUntil - now };
  }

  if (entry.lockedUntil <= now && entry.attempts >= maxAttempts) {
    rateLimiter.delete(key);
    return { limited: false, remainingMs: 0 };
  }

  return { limited: false, remainingMs: 0 };
}

function recordFailedAttempt(
  key: string,
  maxAttempts = 5,
  lockDurationMs = 15 * 60 * 1000
) {
  const now = Date.now();
  const entry = rateLimiter.get(key) || { attempts: 0, lockedUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= maxAttempts) {
    entry.lockedUntil = now + lockDurationMs;
  }
  rateLimiter.set(key, entry);
}

function clearRateLimit(key: string) {
  rateLimiter.delete(key);
}

// ─── Admin Authentication Middleware ──────────────────────────
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: express.NextFunction
) {
  const authHeader =
    req.headers["authorization"] || req.headers["x-admin-token"];
  if (!authHeader) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Silakan login ke dashboard AuthHub sebagai Admin / Superadmin.",
    });
  }

  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : String(authHeader).trim();

  const verified = verifyJwt(token);
  if (!verified.valid || !verified.payload) {
    return res.status(401).json({
      error: "Invalid or expired session token",
      message:
        "Sesi login admin Anda telah berakhir atau tidak valid. Silakan login kembali.",
    });
  }

  const payload = verified.payload;
  const user = db.findUserByIdentifier(payload.sub);
  if (!user || !user.isActive) {
    return res.status(401).json({
      error: "User disabled or not found",
      message: "Akun admin tidak ditemukan atau sedang dinonaktifkan.",
    });
  }

  if (user.globalRole !== "superadmin" && user.globalRole !== "admin") {
    return res.status(403).json({
      error: "Insufficient permissions",
      message:
        "Akses ditolak: Hanya Superadmin atau Admin yang berhak mengelola AuthHub.",
    });
  }

  const session = db.getSessionById(payload.sid);
  if (session && session.revoked) {
    return res.status(401).json({
      error: "Session revoked",
      message: "Sesi login admin ini telah dicabut (revoked). Silakan login ulang.",
    });
  }

  (req as any).adminUser = user;
  (req as any).adminSessionId = payload.sid;
  next();
}

// ─── Health Check (Public) ────────────────────────────────────
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "AuthHub Centralized Identity & SSO Engine",
    version: "1.1.0",
    security: "Hardened with RBAC, JWT Admin Auth & Rate-Limiting",
    timestamp: new Date().toISOString(),
  });
});

// ─── Admin Authentication Endpoints ───────────────────────────
app.post("/api/admin/login", (req: Request, res: Response) => {
  const { identifier, password, totpCode } = req.body;
  const ip = getClientIp(req);
  const rateLimitKey = `admin_login_${ip}_${identifier || ""}`;

  const rateCheck = isRateLimited(rateLimitKey);
  if (rateCheck.limited) {
    const mins = Math.ceil(rateCheck.remainingMs / 60000);
    return res.status(429).json({
      error: `Terlalu banyak percobaan login gagal. Akun/IP diblokir sementara selama ${mins} menit untuk keamanan.`,
      lockout: true,
    });
  }

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ error: "Email/Username dan Password wajib diisi." });
  }

  const user = db.findUserByIdentifier(identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailedAttempt(rateLimitKey);
    db.addAuditLog({
      event: "ADMIN_LOGIN_FAILED",
      userEmail: identifier,
      ipAddress: ip,
      status: "danger",
      details: `Percobaan login admin gagal untuk '${identifier}' (Password salah)`,
    });
    return res
      .status(401)
      .json({ error: "Email/Username atau password salah." });
  }

  if (!user.isActive) {
    return res
      .status(403)
      .json({ error: "Akun Anda sedang dinonaktifkan. Hubungi Administrator." });
  }

  if (user.globalRole !== "superadmin" && user.globalRole !== "admin") {
    db.addAuditLog({
      event: "ADMIN_LOGIN_REJECTED",
      userEmail: user.email,
      ipAddress: ip,
      status: "warning",
      details: `User ${user.email} mencoba login ke Admin Dashboard tanpa hak akses (${user.globalRole})`,
    });
    return res.status(403).json({
      error:
        "Akses ditolak: Akun Anda tidak memiliki hak akses Administrator ke AuthHub.",
    });
  }

  // 2FA TOTP verification if enabled
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode || !verifyTotpCode(user.twoFactorSecret, String(totpCode))) {
      return res.status(401).json({
        error: "Kode 2FA Authenticator diperlukan atau tidak valid.",
        require2FA: true,
        demoHint: generateTotpCode(user.twoFactorSecret),
      });
    }
  }

  // Clear failed rate limit counter on success
  clearRateLimit(rateLimitKey);

  // Create session
  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: "auth-hub-dashboard",
    clientName: "AuthHub Management Dashboard",
    appRole: user.globalRole === "superadmin" ? "superadmin" : "admin",
    ipAddress: ip,
    userAgent: (req.headers["user-agent"] as string) || "AuthHub Admin UI",
    ttlSeconds: 86400,
  });

  const token = signJwt(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      clientId: "auth-hub-dashboard",
      clientSlug: "auth-hub-dashboard",
      scopes: ["admin", "superadmin", "manage:all"],
      sid: session.id,
    },
    86400
  );

  db.addAuditLog({
    event: "ADMIN_LOGIN_SUCCESS",
    userEmail: user.email,
    clientSlug: "auth-hub-dashboard",
    ipAddress: ip,
    status: "success",
    details: `Admin ${user.name} (${user.email}) berhasil login ke AuthHub Dashboard`,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      globalRole: user.globalRole,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
});

app.get("/api/admin/me", requireAdminAuth, (req: Request, res: Response) => {
  const user = (req as any).adminUser;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      globalRole: user.globalRole,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
});

app.post("/api/admin/logout", requireAdminAuth, (req: Request, res: Response) => {
  const sid = (req as any).adminSessionId;
  const user = (req as any).adminUser;
  if (sid) {
    db.revokeSession(sid);
  }
  if (user) {
    db.addAuditLog({
      event: "ADMIN_LOGOUT",
      userEmail: user.email,
      ipAddress: getClientIp(req),
      status: "info",
      details: `Admin ${user.name} keluar dari sesi AuthHub Dashboard`,
    });
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// ─── Dashboard Overview Bundle (Protected) ────────────────────
app.get("/api/overview", requireAdminAuth, (_req: Request, res: Response) => {
  const clients = db.getClients();
  const users = db.getUsers().map((u) => ({
    ...u,
    currentTotpDemo: u.twoFactorSecret
      ? generateTotpCode(u.twoFactorSecret)
      : undefined,
  }));
  const sessions = db.getSessions();
  const auditLogs = db.getAuditLogs();

  const activeSessionsCount = sessions.filter(
    (s) => !s.revoked && new Date(s.expiresAt).getTime() > Date.now()
  ).length;

  res.json({
    stats: {
      totalClients: clients.length,
      totalUsers: users.length,
      activeSessions: activeSessionsCount,
      totalAuditEvents: auditLogs.length,
    },
    clients,
    users,
    sessions,
    auditLogs,
  });
});

// ─── OAuth2 / Connected Projects Management (Protected) ────────
app.get("/api/clients", requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ clients: db.getClients() });
});

app.post("/api/clients", requireAdminAuth, (req: Request, res: Response) => {
  const { name, slug, description, icon, homepageUrl, redirectUris, techStack } =
    req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: "Name and slug are required" });
  }
  if (db.getClientBySlugOrId(slug)) {
    return res.status(409).json({ error: "Application slug already exists" });
  }
  const client = db.createClient({
    name,
    slug,
    description,
    icon,
    homepageUrl,
    redirectUris,
    techStack,
  });
  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "CLIENT_CREATED",
    userEmail: admin?.email || "admin",
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "success",
    details: `Admin ${admin?.name || "admin"} created OAuth2 client '${client.name}' (${client.slug})`,
  });

  res.status(201).json({ client });
});

app.post(
  "/api/clients/:id/rotate-secret",
  requireAdminAuth,
  (req: Request, res: Response) => {
    const id = String(req.params.id);
    const client = db.rotateClientSecret(id);
    if (!client) return res.status(404).json({ error: "Application not found" });

    const admin = (req as any).adminUser;
    db.addAuditLog({
      event: "CLIENT_SECRET_ROTATED",
      userEmail: admin?.email || "admin",
      clientSlug: client.slug,
      ipAddress: getClientIp(req),
      status: "warning",
      details: `Rotated OAuth2 client_secret for ${client.name}`,
    });

    res.json({ client });
  }
);

app.delete(
  "/api/clients/:id",
  requireAdminAuth,
  (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (id === "app_minihost" || id === "minihost") {
      return res
        .status(403)
        .json({ error: "Cannot delete core Mini VPS Panel client" });
    }
    const ok = db.deleteClient(id);
    if (!ok) return res.status(404).json({ error: "Application not found" });

    const admin = (req as any).adminUser;
    db.addAuditLog({
      event: "CLIENT_DELETED",
      userEmail: admin?.email || "admin",
      ipAddress: getClientIp(req),
      status: "danger",
      details: `Deleted OAuth2 client ID '${id}'`,
    });

    res.json({ success: true });
  }
);

// ─── Users & Multi-App RBAC Matrix (Protected) ────────────────
app.get("/api/users", requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ users: db.getUsers() });
});

app.post("/api/users", requireAdminAuth, (req: Request, res: Response) => {
  const { email, username, name, password, globalRole, appRoles } = req.body;
  if (!email || !username || !name || !password) {
    return res
      .status(400)
      .json({ error: "email, username, name, and password are required" });
  }
  if (db.findUserByIdentifier(email) || db.findUserByIdentifier(username)) {
    return res
      .status(409)
      .json({ error: "Email or username already registered" });
  }

  const user = db.createUser({
    email,
    username,
    name,
    password,
    globalRole,
    appRoles,
  });

  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "USER_CREATED",
    userEmail: admin?.email || "admin",
    ipAddress: getClientIp(req),
    status: "success",
    details: `Created user account ${user.name} (${user.email}) with global role ${user.globalRole}`,
  });

  res.status(201).json({ user });
});

app.put("/api/users/:id/role", requireAdminAuth, (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const { clientSlug, role } = req.body as {
    clientSlug: string;
    role: AppRole;
  };
  if (!clientSlug || !role) {
    return res.status(400).json({ error: "clientSlug and role are required" });
  }

  const updated = db.updateUserAppRole(userId, clientSlug, role);
  if (!updated) return res.status(404).json({ error: "User not found" });

  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "ROLE_UPDATED",
    userEmail: admin?.email || updated.email,
    clientSlug,
    ipAddress: getClientIp(req),
    status: "warning",
    details: `Updated access role for ${updated.email} on '${clientSlug}' to '${role.toUpperCase()}'`,
  });

  res.json({ user: updated });
});

app.post("/api/users/:id/toggle-2fa", requireAdminAuth, (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const updated = db.toggleUser2FA(userId);
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json({
    user: {
      ...updated,
      currentTotpDemo: updated.twoFactorSecret
        ? generateTotpCode(updated.twoFactorSecret)
        : undefined,
    },
  });
});

app.delete("/api/users/:id", requireAdminAuth, (req: Request, res: Response) => {
  const userId = String(req.params.id);
  if (userId === "usr_josa_root") {
    return res.status(403).json({ error: "Cannot delete primary root admin" });
  }
  const ok = db.deleteUser(userId);
  if (!ok) return res.status(404).json({ error: "User not found" });
  res.json({ success: true });
});

// ─── Sessions & Global Revocation (Kill-Switch) (Protected) ───
app.post("/api/sessions/:id/revoke", requireAdminAuth, (req: Request, res: Response) => {
  const sid = String(req.params.id);
  const session = db.getSessionById(sid);
  if (!session) return res.status(404).json({ error: "Session not found" });

  db.revokeSession(sid);
  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "SESSION_REVOKED",
    userEmail: admin?.email || session.userEmail,
    clientSlug: session.clientSlug,
    ipAddress: getClientIp(req),
    status: "danger",
    details: `Revoked active SSO session (${sid}) for ${session.userEmail} on ${session.clientName}`,
  });

  res.json({ success: true });
});

app.post("/api/users/:id/revoke-all", requireAdminAuth, (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const user = db.findUserByIdentifier(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const count = db.revokeAllUserSessions(user.id);
  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "SESSION_REVOKED",
    userEmail: admin?.email || user.email,
    ipAddress: getClientIp(req),
    status: "danger",
    details: `Global Kill-Switch: Revoked ${count} active sessions across all ecosystem apps for ${user.email}`,
  });

  res.json({ success: true, revokedCount: count });
});

// ═══════════════════════════════════════════════════════════════
//  STANDARD OAUTH2 / SSO / JWT ENDPOINTS FOR ALL ECOSYSTEM APPS
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Direct SSO Authorize (Login + Consent + Issue OAuth2 Authorization Code)
 * POST /api/v1/auth/authorize
 */
app.post("/api/v1/auth/authorize", (req: Request, res: Response) => {
  const {
    identifier,
    password,
    totpCode,
    clientId,
    clientSlug,
    redirectUri,
    scopes = ["openid", "profile", "email", "roles"],
  } = req.body;

  const ip = getClientIp(req);
  const rateLimitKey = `sso_auth_${ip}_${identifier || ""}`;
  const rateCheck = isRateLimited(rateLimitKey);
  if (rateCheck.limited) {
    const mins = Math.ceil(rateCheck.remainingMs / 60000);
    return res.status(429).json({
      error: `Terlalu banyak percobaan login SSO gagal. Diblokir sementara selama ${mins} menit untuk keamanan.`,
      lockout: true,
    });
  }

  const client =
    db.getClientBySlugOrId(clientId || "") ||
    db.getClientBySlugOrId(clientSlug || "minihost");

  if (!client) {
    return res.status(404).json({ error: "Unregistered OAuth2 Client Application" });
  }

  const user = db.findUserByIdentifier(identifier || "");
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    recordFailedAttempt(rateLimitKey);
    db.addAuditLog({
      event: "SSO_LOGIN_FAILED",
      userEmail: identifier || "unknown",
      clientSlug: client.slug,
      ipAddress: ip,
      status: "danger",
      details: `Failed login attempt on ${client.name} (Invalid credentials)`,
    });
    return res.status(401).json({ error: "Email/Username atau password salah" });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: "Akun pengguna sedang dinonaktifkan" });
  }

  // Check 2FA if enabled
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode || !verifyTotpCode(user.twoFactorSecret, String(totpCode))) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({
        error: "Kode 2FA (Authenticator) diperlukan atau tidak valid",
        require2FA: true,
        demoHint: generateTotpCode(user.twoFactorSecret),
      });
    }
  }

  // Clear failed attempts upon success
  clearRateLimit(rateLimitKey);

  // Check RBAC role for target application
  const appRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[client.slug] || "none";

  if (appRole === "none") {
    db.addAuditLog({
      event: "SSO_LOGIN_FAILED",
      userEmail: user.email,
      clientSlug: client.slug,
      ipAddress: getClientIp(req),
      status: "danger",
      details: `Access Denied: User ${user.email} has role 'none' for ${client.name}`,
    });
    return res.status(403).json({
      error: `Akses Ditolak: Akun ${user.email} tidak memiliki izin akses ke aplikasi ${client.name}`,
    });
  }

  const targetRedirect = redirectUri || client.redirectUris[0];
  const authCode = db.createAuthCode({
    userId: user.id,
    clientId: client.clientId,
    clientSlug: client.slug,
    redirectUri: targetRedirect,
    scopes,
  });

  db.addAuditLog({
    event: "OAUTH_CODE_ISSUED",
    userEmail: user.email,
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "success",
    details: `Issued OAuth2 authorization_code (${authCode.code.slice(0, 16)}...) for ${client.name}`,
  });

  res.json({
    authorizationCode: authCode.code,
    redirectUri: `${targetRedirect}?code=${authCode.code}&state=sso_ok`,
    expiresIn: 300,
    client: {
      name: client.name,
      slug: client.slug,
      icon: client.icon,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      appRole,
    },
  });
});

/**
 * 2. OAuth2 Token Exchange (Backend exchanges authorization_code + client_secret for JWT)
 * POST /api/v1/auth/token
 */
app.post("/api/v1/auth/token", (req: Request, res: Response) => {
  const { code, clientId, clientSecret } = req.body;
  if (!code || !clientId || !clientSecret) {
    return res.status(400).json({
      error: "code, clientId, and clientSecret are required for token exchange",
    });
  }

  const client = db.getClientBySlugOrId(clientId);
  if (!client || client.clientSecret !== clientSecret) {
    return res.status(401).json({ error: "Invalid OAuth2 clientId or clientSecret" });
  }

  const codeRecord = db.consumeAuthCode(code);
  if (!codeRecord || codeRecord.clientId !== client.clientId) {
    return res
      .status(400)
      .json({ error: "Invalid, expired, or already used authorization_code" });
  }

  const user = db.findUserByIdentifier(codeRecord.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const appRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[client.slug] || "none";

  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: client.slug,
    clientName: client.name,
    appRole,
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"] || "Ecosystem Backend Server",
    ttlSeconds: 86400,
  });

  const accessToken = signJwt(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      clientId: client.clientId,
      clientSlug: client.slug,
      appRole,
      scopes: codeRecord.scopes,
      sid: session.id,
    },
    86400
  );

  db.addAuditLog({
    event: "OAUTH_TOKEN_EXCHANGED",
    userEmail: user.email,
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "success",
    details: `Exchanged code for HS256 JWT (sid: ${session.id}, role: ${appRole}) on ${client.name}`,
  });

  res.json({
    tokenType: "Bearer",
    accessToken,
    expiresIn: 86400,
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      globalRole: user.globalRole,
      appRole,
      allAppRoles: user.appRoles,
    },
  });
});

/**
 * 3. Instant Token Introspection & RBAC Verification (Used by Python/Node.js middlewares)
 * POST /api/v1/auth/verify
 */
app.post("/api/v1/auth/verify", (req: Request, res: Response) => {
  const { token, clientSlug } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false, error: "Token is required" });
  }

  const verification = verifyJwt(token);
  if (!verification.valid || !verification.payload) {
    return res.status(401).json({
      valid: false,
      error: verification.error || "Invalid JWT token",
    });
  }

  const payload = verification.payload;
  const session = db.getSessionById(payload.sid);
  if (!session || session.revoked) {
    return res.status(401).json({
      valid: false,
      error: "Session has been revoked via AuthHub Global Logout (Kill-Switch)",
    });
  }

  const user = db.findUserByIdentifier(payload.sub);
  if (!user || !user.isActive) {
    return res.status(401).json({ valid: false, error: "User is inactive" });
  }

  const targetSlug = clientSlug || payload.clientSlug || "minihost";
  const currentAppRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[targetSlug] || "none";

  if (currentAppRole === "none") {
    return res.status(403).json({
      valid: false,
      error: `User no longer has permission to access ${targetSlug}`,
    });
  }

  res.json({
    valid: true,
    sessionId: session.id,
    clientSlug: targetSlug,
    appRole: currentAppRole,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      globalRole: user.globalRole,
    },
    jwtClaims: payload,
  });
});

/**
 * 4. Interactive End-to-End SSO Handshake Simulator (For UI Demonstration)
 * POST /api/v1/auth/simulate-flow
 */
app.post("/api/v1/auth/simulate-flow", requireAdminAuth, (req: Request, res: Response) => {
  const { identifier, password, totpCode, clientSlug } = req.body;
  const client = db.getClientBySlugOrId(clientSlug || "minihost");
  if (!client) {
    return res.status(404).json({ error: "Target application not found" });
  }

  const user = db.findUserByIdentifier(identifier || "");
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    db.addAuditLog({
      event: "SSO_LOGIN_FAILED",
      userEmail: identifier || "unknown",
      clientSlug: client.slug,
      ipAddress: getClientIp(req),
      status: "danger",
      details: `[Simulator] Invalid password for ${identifier} on ${client.name}`,
    });
    return res.status(401).json({
      stepFailed: 2,
      error: "Kredensial tidak valid (Email/Username atau Password salah)",
    });
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!totpCode || !verifyTotpCode(user.twoFactorSecret, String(totpCode))) {
      return res.status(401).json({
        stepFailed: 2,
        require2FA: true,
        demoTotpCode: generateTotpCode(user.twoFactorSecret),
        error: "Akun ini mengaktifkan 2FA. Masukkan 6 digit kode TOTP!",
      });
    }
  }

  const appRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[client.slug] || "none";

  if (appRole === "none") {
    db.addAuditLog({
      event: "SSO_LOGIN_FAILED",
      userEmail: user.email,
      clientSlug: client.slug,
      ipAddress: getClientIp(req),
      status: "danger",
      details: `[Simulator] RBAC Blocked: ${user.email} has role 'none' on ${client.name}`,
    });
    return res.status(403).json({
      stepFailed: 2,
      error: `RBAC Ditolak! User '${user.name}' memiliki role 'NONE' (Tidak Punya Akses) di aplikasi ${client.name}. Ubah role di tab Matriks Role jika ingin mengizinkan.`,
    });
  }

  // Step 2 -> Issue Code
  const authCode = db.createAuthCode({
    userId: user.id,
    clientId: client.clientId,
    clientSlug: client.slug,
    redirectUri: client.redirectUris[0],
    scopes: ["openid", "profile", "email", "roles"],
  });

  // Step 3 -> Consume Code & Create Session + JWT
  db.consumeAuthCode(authCode.code);
  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: client.slug,
    clientName: client.name,
    appRole,
    ipAddress: getClientIp(req),
    userAgent: "AuthHub Interactive SSO Simulator",
    ttlSeconds: 86400,
  });

  const jwtClaims = {
    sub: user.id,
    email: user.email,
    name: user.name,
    globalRole: user.globalRole,
    clientId: client.clientId,
    clientSlug: client.slug,
    appRole,
    scopes: ["openid", "profile", "email", "roles"],
    sid: session.id,
  };

  const accessToken = signJwt(jwtClaims, 86400);
  const decoded = verifyJwt(accessToken);

  db.addAuditLog({
    event: "SSO_LOGIN_SUCCESS",
    userEmail: user.email,
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "success",
    details: `[SSO Handshake Complete] ${user.email} logged into ${client.name} as ${appRole.toUpperCase()}`,
  });

  res.json({
    success: true,
    steps: [
      {
        step: 1,
        title: "1. Redirect dari Aplikasi ke AuthHub",
        protocol: "GET /authorize",
        description: `User klik tombol "Login with AuthHub" di ${client.name}. Browser mengarahkan user ke pusat SSO membawa client_id.`,
        payload: {
          client_id: client.clientId,
          redirect_uri: client.redirectUris[0],
          response_type: "code",
          scope: "openid profile email roles",
        },
      },
      {
        step: 2,
        title: "2. Verifikasi Kredensial, 2FA & Matriks Role (RBAC)",
        protocol: "POST /api/v1/auth/authorize",
        description: `AuthHub memvalidasi password PBKDF2-SHA512${user.twoFactorEnabled ? " + kode 2FA TOTP" : ""} dan memeriksa izin user di aplikasi ${client.name} (Role: ${appRole.toUpperCase()}).`,
        payload: {
          authenticatedUser: user.email,
          globalRole: user.globalRole,
          targetApp: client.slug,
          grantedAppRole: appRole,
          authorizationCode: authCode.code,
          redirectBackTo: `${client.redirectUris[0]}?code=${authCode.code}`,
        },
      },
      {
        step: 3,
        title: "3. Pertukaran Code ke JWT (Back-Channel Server-to-Server)",
        protocol: "POST /api/v1/auth/token",
        description: `Backend ${client.name} mengirim authorization_code + client_secret ke AuthHub di balik layar dan menerima Signed JWT Token.`,
        payload: {
          request: {
            grant_type: "authorization_code",
            code: authCode.code,
            client_id: client.clientId,
            client_secret: `${client.clientSecret.slice(0, 18)}••••••••••••`,
          },
          response: {
            token_type: "Bearer",
            expires_in: 86400,
            session_id: session.id,
            access_token: accessToken,
          },
        },
      },
      {
        step: 4,
        title: "4. Verifikasi Request API & Akses Diberikan",
        protocol: "POST /api/v1/auth/verify",
        description: `Setiap kali user mengakses halaman di ${client.name}, token diverifikasi secara kriptografis dan dicek apakah sesi masih aktif (belum di-revoke).`,
        payload: decoded.payload,
      },
    ],
    accessToken,
    decodedPayload: decoded.payload,
    session,
  });
});

// ─── Dynamic Integration SDK Code Generator ───────────────────
app.get("/api/v1/sdk/:clientSlug", requireAdminAuth, (req: Request, res: Response) => {
  const slug = String(req.params.clientSlug);
  const client =
    db.getClientBySlugOrId(slug) || db.getClientBySlugOrId("minihost")!;
  const host = `${req.protocol}://${req.get("host")}`;

  const expressSnippet = `// ─── Integrasi Node.js / Express untuk ${client.name} (${client.slug}) ───
// Simpan konfigurasi di .env:
// AUTH_HUB_URL=${host}
// AUTH_CLIENT_ID=${client.clientId}
// AUTH_CLIENT_SECRET=${client.clientSecret}

import express from "express";

const AUTH_HUB_URL = process.env.AUTH_HUB_URL || "${host}";

export function requireSSO(minRole = "viewer") {
  const weights = { none: 0, viewer: 1, editor: 2, admin: 3, superadmin: 4 };
  return async (req, res, next) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized: Missing SSO Token" });

    const verifyRes = await fetch(\`\${AUTH_HUB_URL}/api/v1/auth/verify\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, clientSlug: "${client.slug}" }),
    });

    if (!verifyRes.ok) {
      return res.status(401).json({ error: "SSO Session invalid or revoked" });
    }

    const data = await verifyRes.json();
    if ((weights[data.appRole] || 0) < (weights[minRole] || 1)) {
      return res.status(403).json({ error: \`Insufficient role (\${data.appRole})\` });
    }

    req.user = data.user;
    req.appRole = data.appRole;
    next();
  };
}`;

  const fastapiSnippet = `# ─── Integrasi Python FastAPI untuk ${client.name} (${client.slug}) ───
# Tambahkan di apps/backend/.env:
# AUTH_HUB_URL=${host}
# AUTH_CLIENT_ID=${client.clientId}
# AUTH_CLIENT_SECRET=${client.clientSecret}

import os
import requests
from fastapi import Depends, HTTPException, Header

AUTH_HUB_URL = os.getenv("AUTH_HUB_URL", "${host}")
CLIENT_SLUG = "${client.slug}"

def get_current_sso_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing AuthHub Bearer token")
    
    token = authorization.split(" ", 1)[1]
    res = requests.post(
        f"{AUTH_HUB_URL}/api/v1/auth/verify",
        json={"token": token, "clientSlug": CLIENT_SLUG},
        timeout=5,
    )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail=res.json().get("error", "Invalid SSO session"))
    
    data = res.json()
    return {
        "user": data["user"],
        "role": data["appRole"],
        "session_id": data["sessionId"],
    }`;

  const frontendSnippet = `// ─── Integrasi Tombol Login Frontend (${client.name}) ───
const AUTH_HUB_URL = "${host}";
const CLIENT_ID = "${client.clientId}";
const REDIRECT_URI = "${client.redirectUris[0]}";

// 1. Arahkan user ke halaman Login SSO AuthHub
export function loginWithAuthHub() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid profile email roles",
  });
  window.location.href = \`\${AUTH_HUB_URL}/?sso_client=${client.slug}&\${params.toString()}\`;
}

// 2. Di halaman /auth/callback, tukarkan code menjadi JWT Token
export async function handleAuthCallback(code: string) {
  const res = await fetch(\`\${AUTH_HUB_URL}/api/v1/auth/token\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      clientId: CLIENT_ID,
      clientSecret: "${client.clientSecret}", // Idealnya dipanggil dari backend Anda
    }),
  });
  const data = await res.json();
  localStorage.setItem("sso_access_token", data.accessToken);
  return data.user;
}`;

  res.json({
    client,
    snippets: {
      express: expressSnippet,
      fastapi: fastapiSnippet,
      frontend: frontendSnippet,
    },
  });
});

// SPA catch-all fallback
if (fs.existsSync(FRONTEND_DIST)) {
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(
    `🛡️ [AuthHub] Centralized Identity & SSO Engine running on http://localhost:${PORT}`
  );
});

