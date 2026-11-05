import { Router, type Response } from "express";
import { db, type AppRole } from "../db.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { signJwt, verifyJwt, generateTotpCode } from "../crypto.js";
import { getClientIp } from "../utils/rateLimit.js";

export const simulationRouter = Router();

simulationRouter.use(authMiddleware);

/**
 * GET /api/overview
 * Dashboard Overview Bundle (Protected)
 */
simulationRouter.get("/overview", (_req: AuthRequest, res: Response) => {
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

/**
 * POST /api/simulate-sso
 * Simulate end-to-end OAuth2 handshake for any client and user
 */
simulationRouter.post("/simulate-sso", (req: AuthRequest, res: Response) => {
  const { clientSlug, userIdentifier } = req.body;

  const client = db.getClientBySlugOrId(clientSlug || "minihost");
  if (!client) {
    return res.status(404).json({ error: "Target application not found" });
  }

  const user = db.findUserByIdentifier(userIdentifier || "josapratama");
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const appRole: AppRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[client.slug] || "viewer";

  const authCode = db.createAuthCode({
    userId: user.id,
    clientId: client.clientId,
    clientSlug: client.slug,
    redirectUri: client.redirectUris[0],
    scopes: ["openid", "profile", "email", "roles"],
  });

  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: client.slug,
    clientName: client.name,
    appRole,
    ipAddress: getClientIp(req),
    userAgent: "AuthHub Interactive Sandbox Simulator",
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
