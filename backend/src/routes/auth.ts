import { Router, type Request, type Response } from "express";
import { db } from "../db.js";
import { verifyPassword, signJwt, generateTotpCode, verifyTotpCode } from "../crypto.js";
import { getClientIp, isRateLimited, recordFailedAttempt, clearRateLimit } from "../utils/rateLimit.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * POST /api/v1/auth/register
 * Public Self-Registration for End-Users
 */
authRouter.post("/api/v1/auth/register", (req: Request, res: Response) => {
  const settings = db.getSettings();
  if (!settings.allowPublicRegistration) {
    return res.status(403).json({
      error: "Pendaftaran publik sedang dinonaktifkan oleh Administrator AuthHub.",
    });
  }

  const ip = getClientIp(req);
  const rateLimitKey = `reg_${ip}`;
  const rateCheck = isRateLimited(rateLimitKey, 10, 60 * 60 * 1000);
  if (rateCheck.limited) {
    return res.status(429).json({
      error: "Terlalu banyak permintaan pendaftaran dari IP ini. Silakan coba lagi nanti.",
    });
  }

  const { email, username, name, password } = req.body;
  if (!email || !username || !name || !password) {
    return res.status(400).json({
      error: "Nama lengkap, email, username, dan password wajib diisi.",
    });
  }

  const cleanPass = String(password);
  if (cleanPass.length < 6) {
    return res.status(400).json({
      error: "Password minimal harus 6 karakter.",
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanUsername = String(username)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return res.status(400).json({ error: "Format alamat email tidak valid." });
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({
      error: "Username minimal 3 karakter (hanya huruf kecil, angka, dan underscore).",
    });
  }

  if (
    db.findUserByIdentifier(cleanEmail) ||
    db.findUserByIdentifier(cleanUsername)
  ) {
    return res.status(409).json({
      error: "Alamat email atau username tersebut sudah terdaftar.",
    });
  }

  const { user, requireApproval } = db.registerUser({
    email: cleanEmail,
    username: cleanUsername,
    name: String(name).trim(),
    password: cleanPass,
  });

  db.addAuditLog({
    event: "USER_REGISTERED",
    userEmail: user.email,
    ipAddress: ip,
    status: "success",
    details: `User baru '${user.name}' (${user.email}) mendaftar mandiri via Portal SSO${
      requireApproval ? " (Menunggu Persetujuan Admin)" : ""
    }`,
  });

  res.status(201).json({
    success: true,
    requireApproval,
    message: requireApproval
      ? "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan Administrator sebelum dapat digunakan login."
      : "Pendaftaran berhasil! Akun Anda siap digunakan untuk Single Sign-On di seluruh ekosistem project.",
    user,
  });
});

/**
 * POST /api/admin/login
 * Admin Dashboard Login
 */
authRouter.post("/api/admin/login", (req: Request, res: Response) => {
  const { identifier, password, totpCode } = req.body;
  const ip = getClientIp(req);

  const rateLimitKey = `admin_login_${ip}_${identifier || ""}`;
  const rateCheck = isRateLimited(rateLimitKey);
  if (rateCheck.limited) {
    const mins = Math.ceil(rateCheck.remainingMs / 60000);
    return res.status(429).json({
      error: `Terlalu banyak percobaan login admin gagal. Akun diblokir sementara selama ${mins} menit untuk keamanan.`,
      lockout: true,
    });
  }

  const user = db.findUserByIdentifier(identifier || "");
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
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
      error: "Akses ditolak: Akun Anda tidak memiliki hak akses Administrator ke AuthHub.",
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

  clearRateLimit(rateLimitKey);

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

/**
 * GET /api/admin/me
 * Current logged in admin profile
 */
authRouter.get("/api/admin/me", authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.getUsers().find((u) => u.id === req.user?.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
});

/**
 * POST /api/admin/logout
 * Terminate current session
 */
authRouter.post("/api/admin/logout", authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.sid) {
    db.revokeSession(req.user.sid);
  }
  db.addAuditLog({
    event: "ADMIN_LOGOUT",
    userEmail: req.user?.email || "unknown",
    ipAddress: getClientIp(req),
    status: "info",
    details: `Admin ${req.user?.email} logged out from AuthHub Dashboard`,
  });
  res.json({ success: true, message: "Logged out successfully" });
});
