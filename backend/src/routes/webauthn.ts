import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db, type WebAuthnCredential } from "../db.js";
import { signJwt } from "../crypto.js";
import { getClientIp } from "../utils/rateLimit.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";

export const webauthnRouter = Router();

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

  const hostHeader = (req.get("x-forwarded-host") || req.get("host") || "localhost:4100").trim();
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
webauthnRouter.post("/api/webauthn/register/options", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = req.user;
    if (!admin?.sub) return res.status(401).json({ error: "Unauthorized" });

    const user = db.findUserByIdentifier(admin.sub);
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
        userVerification: "required", // User PIN on YubiKey
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
webauthnRouter.post("/api/webauthn/register/verify", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const admin = req.user;
    if (!admin?.sub) return res.status(401).json({ error: "Unauthorized" });

    const user = db.findUserByIdentifier(admin.sub);
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
      requireUserVerification: true,
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
webauthnRouter.get("/api/webauthn/keys", authMiddleware, (req: AuthRequest, res: Response) => {
  const admin = req.user;
  if (!admin?.sub) return res.status(401).json({ error: "Unauthorized" });

  const user = db.findUserByIdentifier(admin.sub);
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
webauthnRouter.delete("/api/webauthn/keys/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const admin = req.user;
  if (!admin?.sub) return res.status(401).json({ error: "Unauthorized" });

  const user = db.findUserByIdentifier(admin.sub);
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
webauthnRouter.post("/api/webauthn/login/options", async (req: Request, res: Response) => {
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
      userVerification: "required", // PIN required
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
webauthnRouter.post("/api/webauthn/login/verify", async (req: Request, res: Response) => {
  try {
    const { challengeSessionId, response, clientSlug, clientId, redirectUri, state } = req.body;
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
      requireUserVerification: true,
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

    const targetSlug = clientSlug || clientId;
    if (targetSlug) {
      const targetClient = db.getClientBySlugOrId(targetSlug);
      if (targetClient) {
        const targetRedirect = redirectUri || targetClient.redirectUris[0];
        const authCode = db.createAuthCode({
          userId: user.id,
          clientId: targetClient.clientId,
          clientSlug: targetClient.slug,
          redirectUri: targetRedirect,
          scopes: ["openid", "profile", "email", "roles"],
        });
        authorizationCode = authCode.code;
        const stateVal = state || "sso";
        const separator = targetRedirect.includes("?") ? "&" : "?";
        oauthRedirectUrl = `${targetRedirect}${separator}code=${encodeURIComponent(authCode.code)}&state=${encodeURIComponent(stateVal)}`;
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
