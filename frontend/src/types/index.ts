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

export interface WebAuthnKeyInfo {
  id: string;
  name?: string;
  createdAt: string;
  counter?: number;
  deviceType?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
  avatar?: string;
  globalRole: "superadmin" | "admin" | "member";
  appRoles: Record<string, AppRole>;
  permissions?: Record<string, string[]>;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  currentTotpDemo?: string;
  webAuthnKeys?: WebAuthnKeyInfo[];
  isActive: boolean;
  createdAt: string;
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

export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  userEmail: string;
  clientSlug?: string;
  ipAddress: string;
  status: "success" | "warning" | "danger" | "info";
  details: string;
}

export interface EmailNotificationSettings {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
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

export interface OverviewStats {
  totalClients: number;
  totalUsers: number;
  activeSessions: number;
  totalAuditEvents: number;
}
