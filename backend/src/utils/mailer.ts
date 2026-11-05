import nodemailer from "nodemailer";
import { db } from "../db.js";
import type { EmailNotificationSettings } from "../types.js";

export type EmailNotificationCategory =
  | "notifyPasswordReset"
  | "notifyNewUserRegistration"
  | "notifyNewDeviceLogin"
  | "notifySessionRevoked";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  category: EmailNotificationCategory;
}

export async function sendNotificationEmail(options: SendEmailOptions): Promise<{ sent: boolean; reason?: string }> {
  const settings = db.getSettings();
  const emailConfig: EmailNotificationSettings = settings.emailNotifications || {
    enabled: true,
    smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpSecure: false,
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    fromAddress: process.env.SMTP_FROM || "auth@josapratama.com",
    fromName: "AuthHub Security & SSO",
    notifyPasswordReset: true,
    notifyNewUserRegistration: true,
    notifyNewDeviceLogin: true,
    notifySessionRevoked: true,
  };

  // 1. Check master toggle
  if (!emailConfig.enabled) {
    return { sent: false, reason: "Semua notifikasi email dinonaktifkan secara global oleh administrator." };
  }

  // 2. Check granular category toggle
  if (!emailConfig[options.category]) {
    return { sent: false, reason: `Kategori notifikasi '${options.category}' dinonaktifkan oleh administrator.` };
  }

  // 3. If SMTP credentials are not filled, record in audit log and simulate delivery safely
  if (!emailConfig.smtpUser || !emailConfig.smtpPass) {
    db.addAuditLog({
      event: "EMAIL_NOTIFICATION_SENT",
      userEmail: options.to,
      ipAddress: "127.0.0.1",
      status: "info",
      details: `[Simulasi Email] Kepada: ${options.to} | Perihal: '${options.subject}' (Kredensial SMTP belum diatur di Pengaturan)`,
    });
    return { sent: true, reason: "Simulasi berhasil (Kredensial SMTP belum dikonfigurasi di tab Pengaturan)." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpSecure, // true for 465, false for 587
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    db.addAuditLog({
      event: "EMAIL_NOTIFICATION_SENT",
      userEmail: options.to,
      ipAddress: "127.0.0.1",
      status: "success",
      details: `Notifikasi email terkirim ke ${options.to}: '${options.subject}'`,
    });

    return { sent: true };
  } catch (err: any) {
    console.error("Nodemailer send error:", err);
    db.addAuditLog({
      event: "EMAIL_NOTIFICATION_SENT",
      userEmail: options.to,
      ipAddress: "127.0.0.1",
      status: "warning",
      details: `Gagal mengirim email ke ${options.to}: ${err.message}`,
    });
    return { sent: false, reason: err.message };
  }
}
