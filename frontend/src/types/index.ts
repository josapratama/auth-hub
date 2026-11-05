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
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  currentTotpDemo?: string;
  webAuthnKeys?: WebAuthnKeyInfo[];
  isActive: boolean;
  createdAt: string;
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
  event: string;
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

export interface OverviewStats {
  totalClients: number;
  totalUsers: number;
  activeSessions: number;
  totalAuditEvents: number;
}
