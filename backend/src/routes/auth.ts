import { Router, type Request, type Response } from "express";
import { db } from "../db.js";
import { verifyPassword, hashPassword, signJwt, generateTotpCode, verifyTotpCode } from "../crypto.js";
import { getClientIp, isRateLimited, recordFailedAttempt, clearRateLimit } from "../utils/rateLimit.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { sendNotificationEmail } from "../utils/mailer.js";
import { parseDeviceInfo } from "../utils/deviceParser.js";

export const authRouter = Router();

/**
 * POST /api/v1/auth/register
 * Public Self-Registration for End-Users
 */
authRouter.post("/api/v1/auth/register", async (req: Request, res: Response) => {
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

  // Send Welcome & Verification Email
  await sendNotificationEmail({
    to: user.email,
    subject: "Selamat Datang di AuthHub SSO Ecosystem",
    category: "notifyNewUserRegistration",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #818cf8; margin-top: 0;">🛡️ Selamat Datang di AuthHub</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Akun identitas Single Sign-On (SSO) Anda dengan username <code>@${user.username}</code> telah berhasil didaftarkan.</p>
        ${
          requireApproval
            ? "<p style='color: #f59e0b;'>⚠️ Akun Anda sedang dalam antrean moderasi oleh Administrator sebelum dapat digunakan login.</p>"
            : "<p style='color: #10b981;'>✅ Akun Anda aktif dan dapat langsung digunakan untuk login di GuidePath, Mini VPS Panel, dan seluruh ekosistem.</p>"
        }
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">AuthHub Security & Identity Engine • Dilindungi oleh FIDO2 WebAuthn & PBKDF2-SHA512</p>
      </div>
    `,
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
 * POST /api/v1/auth/forgot-password
 * Request OTP & Reset Token via Email
 */
authRouter.post("/api/v1/auth/forgot-password", async (req: Request, res: Response) => {
  const { identifier } = req.body;
  const ip = getClientIp(req);

  if (!identifier) {
    return res.status(400).json({ error: "Email atau username wajib diisi." });
  }

  const user = db.findUserByIdentifier(String(identifier));
  if (!user) {
    // Safe response to prevent account enumeration
    return res.json({
      success: true,
      message: "Jika email atau username terdaftar, instruksi reset password beserta kode OTP telah dikirimkan.",
    });
  }

  const resetRecord = db.createPasswordReset(user.id, user.email);

  db.addAuditLog({
    event: "PASSWORD_RESET_REQUESTED",
    userEmail: user.email,
    ipAddress: ip,
    status: "info",
    details: `Permintaan reset password diajukan untuk '${user.email}' (OTP: ${resetRecord.otp})`,
  });

  // Send Email with OTP code
  await sendNotificationEmail({
    to: user.email,
    subject: "Kode OTP Reset Password AuthHub",
    category: "notifyPasswordReset",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #818cf8; margin-top: 0;">🔐 Permintaan Reset Password</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Kami menerima permintaan untuk mengatur ulang password akun AuthHub Anda. Gunakan kode 6-digit OTP berikut:</p>
        <div style="background: #1e1b4b; border: 1px solid #6366f1; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 8px; color: #a5b4fc;">
            ${resetRecord.otp}
          </span>
        </div>
        <p style="font-size: 13px; color: #cbd5e1;">Kode ini berlaku selama <strong>15 menit</strong>. Jangan bagikan kode ini kepada siapa pun.</p>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b;">Jika Anda tidak merasa mengajukan permintaan ini, abaikan email ini dan akun Anda tetap aman.</p>
      </div>
    `,
  });

  res.json({
    success: true,
    message: "Kode OTP reset password telah dikirimkan ke email Anda. Silakan periksa kotak masuk atau spam.",
    demoOtp: process.env.NODE_ENV !== "production" ? resetRecord.otp : undefined,
  });
});

/**
 * POST /api/v1/auth/reset-password
 * Complete password reset using OTP or Token
 */
authRouter.post("/api/v1/auth/reset-password", async (req: Request, res: Response) => {
  const { otpOrToken, newPassword } = req.body;
  const ip = getClientIp(req);

  if (!otpOrToken || !newPassword) {
    return res.status(400).json({ error: "Kode OTP dan password baru wajib diisi." });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "Password baru minimal 6 karakter." });
  }

  const resetRecord = db.consumePasswordReset(String(otpOrToken).trim());
  if (!resetRecord) {
    return res.status(400).json({ error: "Kode OTP atau token tidak valid, telah kedaluwarsa, atau sudah digunakan." });
  }

  const user = db.findUserByIdentifier(resetRecord.userId);
  if (!user) {
    return res.status(404).json({ error: "User tidak ditemukan." });
  }

  user.passwordHash = hashPassword(String(newPassword));
  user.updatedAt = new Date().toISOString();
  db.save();

  // Invalidate old sessions for security
  db.revokeAllUserSessions(user.id);

  db.addAuditLog({
    event: "PASSWORD_RESET_COMPLETED",
    userEmail: user.email,
    ipAddress: ip,
    status: "success",
    details: `Password untuk akun '${user.email}' berhasil diubah via verifikasi OTP email`,
  });

  // Send confirmation email
  await sendNotificationEmail({
    to: user.email,
    subject: "Password AuthHub Anda Berhasil Diperbarui",
    category: "notifyPasswordReset",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #10b981; margin-top: 0;">✅ Password Berhasil Diperbarui</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Password untuk akun AuthHub Anda (<code>${user.email}</code>) telah berhasil diperbarui pada ${new Date().toLocaleString('id-ID')}.</p>
        <p>Seluruh sesi aktif di perangkat lain telah diputus demi keamanan.</p>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b;">Jika Anda tidak merasa melakukan perubahan ini, segera hubungi Administrator sistem.</p>
      </div>
    `,
  });

  res.json({
    success: true,
    message: "Password berhasil diperbarui! Silakan masuk dengan password baru Anda.",
  });
});

/**
 * POST /api/admin/login
 * Admin Dashboard Login
 */
authRouter.post("/api/admin/login", async (req: Request, res: Response) => {
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
  const deviceInfo = parseDeviceInfo(req);

  const session = db.createSession({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    clientSlug: "auth-hub-dashboard",
    clientName: "AuthHub Management Dashboard",
    appRole: user.globalRole === "superadmin" ? "superadmin" : "admin",
    ipAddress: ip,
    userAgent: (req.headers["user-agent"] as string) || "AuthHub Admin UI",
    deviceInfo,
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
    details: `Admin ${user.name} (${user.email}) berhasil login (${deviceInfo.browser} di ${deviceInfo.os})`,
  });

  // Notify new device login via email
  sendNotificationEmail({
    to: user.email,
    subject: "Peringatan Keamanan: Login Baru Terdeteksi",
    category: "notifyNewDeviceLogin",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #1e293b;">
        <h2 style="color: #6366f1; margin-top: 0;">🛡️ Login Baru Terdeteksi</h2>
        <p>Halo <strong>${user.name}</strong>,</p>
        <p>Sesi login baru berhasil dibuat untuk akun Anda di <strong>AuthHub Management Dashboard</strong>:</p>
        <ul style="color: #cbd5e1; line-height: 1.8;">
          <li><strong>Perangkat:</strong> ${deviceInfo.browser} (${deviceInfo.os})</li>
          <li><strong>Tipe Perangkat:</strong> ${deviceInfo.device}</li>
          <li><strong>IP Address:</strong> ${ip}</li>
          <li><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</li>
        </ul>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        <p style="font-size: 11px; color: #64748b;">Jika ini bukan Anda, segera putuskan sesi di tab Sesi Aktif dan ubah password Anda.</p>
      </div>
    `,
  }).catch(() => {});

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
 * Current logged in user profile
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
