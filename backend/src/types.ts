export type AppRole = "superadmin" | "admin" | "editor" | "viewer" | "none";

export interface OAuthClient {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  homepageUrl: string;
  techStack: string;
  require2FA: boolean;
  isActive: boolean;
  backchannelLogoutUri?: string;
  availablePermissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WebAuthnCredential {
  id: string; // Base64URL string of credential ID
  publicKey: string; // Base64 representation of public key Uint8Array
  counter: number;
  transports?: string[];
  deviceType?: string;
  backedUp?: boolean;
  name?: string; // Friendly name: "YubiKey 5 NFC (Hardware Token)"
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  passwordHash: string;
  globalRole: "superadmin" | "admin" | "member";
  /** Map of clientSlug -> role */
  appRoles: Record<string, AppRole>;
  /** Map of clientSlug -> specific permission keys */
  permissions?: Record<string, string[]>;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  webAuthnCredentials?: WebAuthnCredential[];
  phoneWhatsapp?: string;
  telegramChatId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCodeRecord {
  code: string;
  userId: string;
  clientId: string;
  clientSlug: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: number;
  used: boolean;
}

export interface SessionDeviceInfo {
  browser: string;
  os: string;
  device: string;
  ip: string;
  location: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  clientSlug: string;
  clientName: string;
  appRole: AppRole;
  permissions?: string[];
  ipAddress: string;
  userAgent: string;
  deviceInfo?: SessionDeviceInfo;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
}

export interface PasswordResetToken {
  token: string;
  otp: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  event:
    | "SSO_LOGIN_SUCCESS"
    | "SSO_LOGIN_FAILED"
    | "ADMIN_LOGIN_SUCCESS"
    | "ADMIN_LOGIN_FAILED"
    | "ADMIN_LOGIN_REJECTED"
    | "ADMIN_LOGOUT"
    | "OAUTH_CODE_ISSUED"
    | "OAUTH_TOKEN_EXCHANGED"
    | "TOKEN_VERIFIED"
    | "SESSION_REVOKED"
    | "ROLE_UPDATED"
    | "CLIENT_SECRET_ROTATED"
    | "CLIENT_CREATED"
    | "CLIENT_DELETED"
    | "USER_CREATED"
    | "USER_REGISTERED"
    | "USER_STATUS_TOGGLED"
    | "SETTINGS_UPDATED"
    | "WEBAUTHN_KEY_REGISTERED"
    | "WEBAUTHN_KEY_DELETED"
    | "WEBAUTHN_LOGIN_SUCCESS"
    | "WEBAUTHN_LOGIN_FAILED"
    | "PASSWORD_RESET_REQUESTED"
    | "PASSWORD_RESET_COMPLETED"
    | "BACKCHANNEL_LOGOUT_SENT"
    | "EMAIL_NOTIFICATION_SENT";
  userEmail: string;
  clientSlug?: string;
  ipAddress: string;
  status: "success" | "warning" | "danger" | "info";
  details: string;
}

export interface EmailNotificationSettings {
  enabled: boolean; // Master toggle
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  // Granular individual notification toggles:
  notifyPasswordReset: boolean;
  notifyNewUserRegistration: boolean;
  notifyNewDeviceLogin: boolean;
  notifySessionRevoked: boolean;
}

export interface AuthHubSettings {
  allowPublicRegistration: boolean;
  requireAdminApproval: boolean;
  defaultMemberRole: "viewer" | "member";
  publicClientSlugs: string[];
  emailNotifications?: EmailNotificationSettings;
}

export interface AuthHubSchema {
  settings?: AuthHubSettings;
  clients: OAuthClient[];
  users: AuthUser[];
  authCodes: AuthCodeRecord[];
  sessions: AuthSession[];
  auditLogs: AuditLog[];
  passwordResets?: PasswordResetToken[];
}
