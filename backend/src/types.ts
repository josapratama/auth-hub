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

export interface AuthSession {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  clientSlug: string;
  clientName: string;
  appRole: AppRole;
  ipAddress: string;
  userAgent: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
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
    | "WEBAUTHN_LOGIN_FAILED";
  userEmail: string;
  clientSlug?: string;
  ipAddress: string;
  status: "success" | "warning" | "danger" | "info";
  details: string;
}

export interface AuthHubSettings {
  allowPublicRegistration: boolean;
  requireAdminApproval: boolean;
  defaultMemberRole: "viewer" | "member";
  publicClientSlugs: string[];
}

export interface AuthHubSchema {
  settings?: AuthHubSettings;
  clients: OAuthClient[];
  users: AuthUser[];
  authCodes: AuthCodeRecord[];
  sessions: AuthSession[];
  auditLogs: AuditLog[];
}
