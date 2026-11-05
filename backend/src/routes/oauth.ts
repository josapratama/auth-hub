import { Router, type Request, type Response } from "express";
import { db, type AppRole } from "../db.js";
import { verifyPassword, signJwt, verifyJwt, verifyTotpCode, generateTotpCode, getPublicJwks } from "../crypto.js";
import { getClientIp, isRateLimited, recordFailedAttempt, clearRateLimit } from "../utils/rateLimit.js";
import { parseDeviceInfo } from "../utils/deviceParser.js";

export const oauthRouter = Router();

/**
 * 0. OIDC Discovery Endpoint
 * GET /.well-known/openid-configuration
 */
oauthRouter.get("/.well-known/openid-configuration", (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get("host")}`;
  res.json({
    issuer: host,
    authorization_endpoint: `${host}/oauth/authorize`,
    token_endpoint: `${host}/api/v1/auth/token`,
    userinfo_endpoint: `${host}/api/v1/auth/verify`,
    jwks_uri: `${host}/.well-known/jwks.json`,
    response_types_supported: ["code", "token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256", "HS256"],
    scopes_supported: ["openid", "profile", "email", "roles", "permissions"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    claims_supported: ["sub", "iss", "email", "name", "appRole", "permissions", "globalRole", "sid"],
  });
});

/**
 * 0. JWKS Public Keys Endpoint
 * GET /.well-known/jwks.json
 */
oauthRouter.get("/.well-known/jwks.json", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json(getPublicJwks());
});

/**
 * GET /oauth/authorize
 * Standard OAuth2 Browser Authorization Endpoint
 */
oauthRouter.get("/oauth/authorize", (req: Request, res: Response) => {
  const { client_id, client_slug, redirect_uri, response_type, state, scope } = req.query;
  const client =
    db.getClientBySlugOrId(String(client_id || "")) ||
    db.getClientBySlugOrId(String(client_slug || "")) ||
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
 * POST /api/v1/auth/authorize
 * Direct SSO Authorize (Login + Issue OAuth2 Authorization Code)
 */
oauthRouter.post("/api/v1/auth/authorize", (req: Request, res: Response) => {
  const {
    identifier,
    password,
    totpCode,
    clientId,
    clientSlug,
    redirectUri,
    scopes = ["openid", "profile", "email", "roles", "permissions"],
    state = "sso",
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
    db.getClientBySlugOrId(clientSlug || "guidepath");

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
      ipAddress: ip,
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

  const stateVal = state ? String(state) : "sso_ok";
  const separator = targetRedirect.includes("?") ? "&" : "?";
  const finalRedirectUri = `${targetRedirect}${separator}code=${encodeURIComponent(authCode.code)}&state=${encodeURIComponent(stateVal)}`;

  db.addAuditLog({
    event: "OAUTH_CODE_ISSUED",
    userEmail: user.email,
    clientSlug: client.slug,
    ipAddress: ip,
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
      permissions: user.permissions?.[client.slug] || [],
    },
  });
});

/**
 * POST /api/v1/auth/token
 * Exchange authorization_code + client_secret for Signed RS256 JWT Token
 */
oauthRouter.post("/api/v1/auth/token", (req: Request, res: Response) => {
  const { code, clientId, clientSecret, grantType = "authorization_code" } = req.body;
  const ip = getClientIp(req);

  if (grantType !== "authorization_code") {
    return res.status(400).json({ error: "Unsupported grant_type. Expected 'authorization_code'" });
  }

  const client = db.getClientBySlugOrId(clientId || "");
  if (!client || client.clientSecret !== clientSecret) {
    db.addAuditLog({
      event: "SSO_LOGIN_FAILED",
      userEmail: "system",
      clientSlug: client?.slug,
      ipAddress: ip,
      status: "danger",
      details: `OAuth token exchange failed: Invalid client credentials for '${clientId}'`,
    });
    return res.status(401).json({ error: "Invalid client_id or client_secret" });
  }

  const authCode = db.consumeAuthCode(code || "");
  if (!authCode) {
    return res.status(400).json({ error: "Invalid, expired, or already used authorization_code" });
  }

  const user = db.getUsers().find((u) => u.id === authCode.userId);
  if (!user || !user.isActive) {
    return res.status(403).json({ error: "User account inactive or deleted" });
  }

  const appRole =
    user.globalRole === "superadmin"
      ? "superadmin"
      : user.appRoles[client.slug] || "viewer";

  const permissions = user.permissions?.[client.slug] || client.availablePermissions || [];
  const deviceInfo = parseDeviceInfo(req);

  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: client.slug,
    clientName: client.name,
    appRole,
    permissions,
    ipAddress: ip,
    userAgent: (req.headers["user-agent"] as string) || "OAuth2 Client Service",
    deviceInfo,
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
      permissions,
      scopes: authCode.scopes,
      sid: session.id,
    },
    86400
  );

  db.addAuditLog({
    event: "OAUTH_TOKEN_EXCHANGED",
    userEmail: user.email,
    clientSlug: client.slug,
    ipAddress: ip,
    status: "success",
    details: `Signed RS256 JWT issued for ${user.email} in ${client.name} (Role: ${appRole.toUpperCase()}, Session: ${session.id})`,
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
      appRole,
      permissions,
      globalRole: user.globalRole,
    },
    client: {
      name: client.name,
      slug: client.slug,
    },
  });
});

/**
 * POST /api/v1/auth/verify
 * Microservice Token Introspection Endpoint
 */
oauthRouter.post("/api/v1/auth/verify", (req: Request, res: Response) => {
  const { token, clientSlug } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, error: "Missing token to verify" });
  }

  const verified = verifyJwt(token);
  if (!verified.valid || !verified.payload) {
    return res.status(401).json({ valid: false, error: verified.error || "Token invalid or expired" });
  }

  // Check if session was revoked in AuthHub
  if (verified.payload.sid) {
    const session = db.getSessionById(verified.payload.sid);
    if (!session || session.revoked) {
      return res.status(401).json({
        valid: false,
        error: "Session has been revoked by Administrator (Global Kill-Switch)",
      });
    }
  }

  // If specific clientSlug requested, check RBAC
  if (clientSlug && verified.payload.clientSlug && verified.payload.clientSlug !== clientSlug) {
    return res.status(403).json({
      valid: false,
      error: `Token issued for '${verified.payload.clientSlug}', not valid for '${clientSlug}'`,
    });
  }

  res.json({
    valid: true,
    user: {
      id: verified.payload.sub,
      email: verified.payload.email,
      name: verified.payload.name,
      globalRole: verified.payload.globalRole,
      appRole: verified.payload.appRole,
      permissions: verified.payload.permissions || [],
      scopes: verified.payload.scopes,
    },
    sessionId: verified.payload.sid,
    expiresAt: verified.payload.exp,
  });
});
