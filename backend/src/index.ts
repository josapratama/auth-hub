import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, AppRole, WebAuthnCredential } from "./db.js";
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
    version: "1.2.0",
    security: "Hardened with RBAC, JWT Admin Auth, Self-Registration & Rate-Limiting",
    timestamp: new Date().toISOString(),
  });
});

// ─── Public Settings (For Login/Registration UI Check) ────────
app.get("/api/public-settings", (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    allowPublicRegistration: settings.allowPublicRegistration,
    requireAdminApproval: settings.requireAdminApproval,
    publicClients: db
      .getClients()
      .filter((c) => settings.publicClientSlugs.includes(c.slug))
      .map((c) => ({ slug: c.slug, name: c.name, icon: c.icon })),
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

// ─── WebAuthn / YubiKey (FIDO2 + PIN Verification) Endpoints ──
interface StoredChallenge {
  challenge: string;
  userId?: string;
  createdAt: number;
}
const webAuthnChallenges = new Map<string, StoredChallenge>();

// Clean expired challenges periodically (TTL 5 mins)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of webAuthnChallenges.entries()) {
    if (now - val.createdAt > 5 * 60 * 1000) {
      webAuthnChallenges.delete(key);
    }
  }
}, 60 * 1000);

function getRpConfig(req: Request) {
  const envRpId = process.env.WEBAUTHN_RP_ID;
  const envOrigin = process.env.WEBAUTHN_ORIGIN;

  const hostHeader = (req.get("x-forwarded-host") || req.get("host") || "localhost:4199").trim();
  const hostname = hostHeader.split(":")[0];
  const proto = (req.get("x-forwarded-proto") || (req.protocol === "https" ? "https" : "http")).trim();
  const origin = envOrigin || `${proto}://${hostHeader}`;
  const rpID = envRpId || hostname;

  return {
    rpID,
    rpName: "AuthHub SSO Security",
    origin,
  };
}

/**
 * 1. Register WebAuthn / YubiKey Options (Protected)
 * POST /api/webauthn/register/options
 */
app.post("/api/webauthn/register/options", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const user = db.findUserByIdentifier(admin.id);
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const rpConfig = getRpConfig(req);
    const existingCreds = user.webAuthnCredentials || [];

    const options = await generateRegistrationOptions({
      rpName: rpConfig.rpName,
      rpID: rpConfig.rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.name,
      authenticatorSelection: {
        userVerification: "required", // <-- Wajib memasukkan User PIN pada YubiKey!
        residentKey: "preferred",
      },
      excludeCredentials: existingCreds.map((c) => ({
        id: c.id,
        transports: c.transports as any,
      })),
    });

    const challengeKey = `reg_${user.id}`;
    webAuthnChallenges.set(challengeKey, {
      challenge: options.challenge,
      userId: user.id,
      createdAt: Date.now(),
    });

    res.json(options);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal membuat opsi pendaftaran YubiKey" });
  }
});

/**
 * 2. Verify Registration Response & Save YubiKey Credential (Protected)
 * POST /api/webauthn/register/verify
 */
app.post("/api/webauthn/register/verify", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).adminUser;
    const user = db.findUserByIdentifier(admin.id);
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const challengeKey = `reg_${user.id}`;
    const stored = webAuthnChallenges.get(challengeKey);
    if (!stored) {
      return res.status(400).json({ error: "Sesi challenge registrasi kedaluwarsa. Silakan ulangi." });
    }
    webAuthnChallenges.delete(challengeKey);

    const rpConfig = getRpConfig(req);
    const { response, keyName } = req.body;
    if (!response) {
      return res.status(400).json({ error: "Respon registrasi YubiKey tidak lengkap." });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpConfig.origin,
      expectedRPID: rpConfig.rpID,
      requireUserVerification: true, // <-- Verifikasi bahwa PIN YubiKey telah dimasukkan
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Verifikasi kriptografi YubiKey gagal." });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const newCred: WebAuthnCredential = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: keyName?.trim() || "YubiKey Security Key (PIN)",
      createdAt: new Date().toISOString(),
    };

    db.addWebAuthnCredential(user.id, newCred);

    db.addAuditLog({
      event: "WEBAUTHN_KEY_REGISTERED",
      userEmail: user.email,
      ipAddress: getClientIp(req),
      status: "success",
      details: `Hardware Security Key (YubiKey) '${newCred.name}' berhasil didaftarkan dengan User PIN verification.`,
    });

    res.json({
      success: true,
      message: `YubiKey '${newCred.name}' berhasil didaftarkan dan diproteksi PIN!`,
      credential: {
        id: newCred.id,
        name: newCred.name,
        createdAt: newCred.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memverifikasi YubiKey" });
  }
});

/**
 * 3. List Registered YubiKeys for Current User (Protected)
 * GET /api/webauthn/keys
 */
app.get("/api/webauthn/keys", requireAdminAuth, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const user = db.findUserByIdentifier(admin.id);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

  const keys = (user.webAuthnCredentials || []).map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    counter: c.counter,
    deviceType: c.deviceType,
  }));

  res.json({ keys });
});

/**
 * 4. Delete a Registered YubiKey (Protected)
 * DELETE /api/webauthn/keys/:id
 */
app.delete("/api/webauthn/keys/:id", requireAdminAuth, (req: Request, res: Response) => {
  const admin = (req as any).adminUser;
  const user = db.findUserByIdentifier(admin.id);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

  const credId = String(req.params.id);
  const cred = user.webAuthnCredentials?.find((c) => c.id === credId);
  const deleted = db.removeWebAuthnCredential(user.id, credId);

  if (deleted) {
    db.addAuditLog({
      event: "WEBAUTHN_KEY_DELETED",
      userEmail: user.email,
      ipAddress: getClientIp(req),
      status: "warning",
      details: `Kunci keamanan YubiKey '${cred?.name || credId}' telah dihapus dari akun ${user.email}.`,
    });
    return res.json({ success: true, message: "Kunci keamanan YubiKey berhasil dihapus." });
  }

  res.status(404).json({ error: "Kunci keamanan tidak ditemukan." });
});

/**
 * 5. Public Authentication Options for YubiKey Login
 * POST /api/webauthn/login/options
 */
app.post("/api/webauthn/login/options", async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    const rpConfig = getRpConfig(req);

    let allowCredentials: any[] | undefined = undefined;
    let targetUser = undefined;

    if (identifier) {
      targetUser = db.findUserByIdentifier(String(identifier));
      if (!targetUser) {
        return res.status(404).json({ error: "Pengguna dengan email/username ini tidak ditemukan." });
      }
      if (targetUser.isActive === false) {
        return res.status(403).json({ error: "Akun ini sedang ditangguhkan atau menunggu persetujuan admin." });
      }
      if (!targetUser.webAuthnCredentials || targetUser.webAuthnCredentials.length === 0) {
        return res.status(400).json({
          error: "Akun ini belum memiliki YubiKey terdaftar. Silakan login dengan password terlebih dahulu untuk mendaftarkan YubiKey Anda.",
        });
      }
      allowCredentials = targetUser.webAuthnCredentials.map((c) => ({
        id: c.id,
        transports: c.transports as any,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: rpConfig.rpID,
      userVerification: "required", // <-- Wajib memasukkan User PIN pada YubiKey!
      allowCredentials,
    });

    const challengeSessionId = crypto.randomBytes(16).toString("hex");
    webAuthnChallenges.set(`auth_${challengeSessionId}`, {
      challenge: options.challenge,
      userId: targetUser?.id,
      createdAt: Date.now(),
    });

    res.json({
      options,
      challengeSessionId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal membuat sesi login YubiKey" });
  }
});

/**
 * 6. Public Verify YubiKey Login Assertion (PIN + Touch)
 * POST /api/webauthn/login/verify
 */
app.post("/api/webauthn/login/verify", async (req: Request, res: Response) => {
  try {
    const { challengeSessionId, response } = req.body;
    if (!challengeSessionId || !response) {
      return res.status(400).json({ error: "Data respon autentikasi YubiKey tidak lengkap." });
    }

    const challengeKey = `auth_${challengeSessionId}`;
    const stored = webAuthnChallenges.get(challengeKey);
    if (!stored) {
      return res.status(400).json({ error: "Sesi challenge login kedaluwarsa. Silakan coba lagi." });
    }
    webAuthnChallenges.delete(challengeKey);

    const credId = response.id;
    let user = stored.userId
      ? db.findUserByIdentifier(stored.userId)
      : db.findUserByCredentialId(credId);

    if (!user) {
      return res.status(404).json({ error: "Kunci keamanan (YubiKey) ini tidak terdaftar pada akun mana pun." });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: "Akun Anda saat ini sedang dinonaktifkan atau ditangguhkan." });
    }

    const cred = user.webAuthnCredentials?.find((c) => c.id === credId);
    if (!cred) {
      return res.status(400).json({ error: "Kredensial YubiKey tidak valid untuk akun ini." });
    }

    const rpConfig = getRpConfig(req);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpConfig.origin,
      expectedRPID: rpConfig.rpID,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64")),
        counter: cred.counter,
        transports: cred.transports as any,
      },
      requireUserVerification: true, // <-- Verifikasi bahwa User PIN YubiKey telah divalidasi
    });

    if (!verification.verified) {
      db.addAuditLog({
        event: "WEBAUTHN_LOGIN_FAILED",
        userEmail: user.email,
        ipAddress: getClientIp(req),
        status: "danger",
        details: `Autentikasi YubiKey '${cred.name}' ditolak atau verifikasi PIN gagal.`,
      });
      return res.status(401).json({ error: "Autentikasi YubiKey ditolak." });
    }

    // Update counter
    db.updateWebAuthnCounter(user.id, cred.id, verification.authenticationInfo.newCounter);

    const ip = getClientIp(req);
    db.addAuditLog({
      event: "WEBAUTHN_LOGIN_SUCCESS",
      userEmail: user.email,
      ipAddress: ip,
      status: "success",
      details: `Login berhasil menggunakan YubiKey Hardware Token '${cred.name}' dengan PIN terverifikasi.`,
    });

    // Create session
    const session = db.createSession({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      clientSlug: "auth-hub-dashboard",
      clientName: "AuthHub Management Dashboard",
      appRole: user.globalRole === "superadmin" ? "superadmin" : "admin",
      ipAddress: ip,
      userAgent: (req.headers["user-agent"] as string) || "AuthHub YubiKey Login",
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

    const { passwordHash, twoFactorSecret, ...safeUser } = user;

    let authorizationCode: string | undefined = undefined;
    let oauthRedirectUrl: string | undefined = undefined;

    if (req.body.clientSlug || req.body.clientId) {
      const targetClient = db.getClientBySlugOrId(req.body.clientSlug || req.body.clientId);
      if (targetClient) {
        const targetRedirect = req.body.redirectUri || targetClient.redirectUris[0];
        const authCode = db.createAuthCode({
          userId: user.id,
          clientId: targetClient.clientId,
          clientSlug: targetClient.slug,
          redirectUri: targetRedirect,
          scopes: ["openid", "profile", "email", "roles"],
        });
        authorizationCode = authCode.code;
        const state = req.body.state || "sso";
        oauthRedirectUrl = `${targetRedirect}${targetRedirect.includes("?") ? "&" : "?"}code=${authCode.code}&state=${encodeURIComponent(state)}`;
      }
    }

    res.json({
      success: true,
      token,
      user: safeUser,
      keyName: cred.name,
      authorizationCode,
      redirectUri: oauthRedirectUrl,
      message: `Selamat datang kembali, ${user.name}! Autentikasi YubiKey (PIN + Touch) berhasil.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Gagal memverifikasi login YubiKey" });
  }
});

// ─── Dashboard Overview Bundle (Protected) ────────────────────
app.get("/api/overview", requireAdminAuth, (_req: Request, res: Response) => {
  const clients = db.getClients();
  const users = db.getUsers().map((u) => ({
    ...u,
    currentTotpDemo: u.twoFactorSecret
      ? generateTotpCode(u.twoFactorSecret)
      : undefined,
    webAuthnKeys: (u.webAuthnCredentials || []).map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      counter: c.counter,
    })),
  }));
  const sessions = db.getSessions();
  const auditLogs = db.getAuditLogs();
  const settings = db.getSettings();

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
    settings,
    clients,
    users,
    sessions,
    auditLogs,
  });
});

// ─── System Policy & Settings Management (Protected) ──────────
app.get("/api/settings", requireAdminAuth, (_req: Request, res: Response) => {
  res.json({ settings: db.getSettings() });
});

app.put("/api/settings", requireAdminAuth, (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  const admin = (req as any).adminUser;
  db.addAuditLog({
    event: "SETTINGS_UPDATED",
    userEmail: admin?.email || "admin",
    ipAddress: getClientIp(req),
    status: "warning",
    details: `Admin ${admin?.name || "admin"} updated AuthHub security, registration, and RBAC policies`,
  });
  res.json({ settings: updated });
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

app.put(
  "/api/users/:id/toggle-status",
  requireAdminAuth,
  (req: Request, res: Response) => {
    const userId = String(req.params.id);
    if (userId === "usr_josa_root") {
      return res
        .status(403)
        .json({ error: "Cannot deactivate primary root admin" });
    }
    const updated = db.toggleUserActive(userId);
    if (!updated) return res.status(404).json({ error: "User not found" });

    if (!updated.isActive) {
      db.revokeAllUserSessions(userId);
    }

    const admin = (req as any).adminUser;
    db.addAuditLog({
      event: "USER_STATUS_TOGGLED",
      userEmail: admin?.email || "admin",
      ipAddress: getClientIp(req),
      status: updated.isActive ? "success" : "warning",
      details: `Admin ${admin?.name || "admin"} ${
        updated.isActive ? "mengaktifkan kembali" : "menonaktifkan (suspend)"
      } akun ${updated.email}`,
    });

    res.json({ user: updated });
  }
);

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
 * 0. Public Self-Registration for End-Users
 * POST /api/v1/auth/register
 */
app.post("/api/v1/auth/register", (req: Request, res: Response) => {
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
 * 0. Standard OAuth2 Browser Authorization Endpoint
 * GET /oauth/authorize
 * Redirects user to AuthHub SSO Consent & Login UI with target client parameters.
 */
app.get("/oauth/authorize", (req: Request, res: Response) => {
  const { client_id, redirect_uri, response_type, state, scope } = req.query;
  const client =
    db.getClientBySlugOrId(String(client_id || "")) ||
    db.getClientBySlugOrId("guidepath");

  if (!client) {
    return res.status(404).send("Error: OAuth2 Client Application not registered in AuthHub");
  }

  const targetRedirect = String(redirect_uri || client.redirectUris[0]);
  const ssoQuery = new URLSearchParams({
    oauth: "1",
    client_id: client.clientId,
    client_slug: client.slug,
    client_name: client.name,
    client_icon: client.icon,
    redirect_uri: targetRedirect,
    state: String(state || "sso"),
    response_type: String(response_type || "code"),
  }).toString();

  res.redirect(`/?${ssoQuery}`);
});

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
  const hubSettings = db.getSettings();
  const isPublicClient = (hubSettings.publicClientSlugs || []).includes(client.slug);
  const appRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : (user.appRoles && user.appRoles[client.slug] && user.appRoles[client.slug] !== "none")
        ? user.appRoles[client.slug]
        : (isPublicClient ? "viewer" : "none");

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

  const stateVal = (req.body && req.body.state) ? String(req.body.state) : "sso_ok";
  const separator = targetRedirect.includes("?") ? "&" : "?";
  const finalRedirectUri = `${targetRedirect}${separator}code=${encodeURIComponent(authCode.code)}&state=${encodeURIComponent(stateVal)}`;

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
    redirectUri: finalRedirectUri,
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

