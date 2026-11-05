import fs from "fs";
import path from "path";
import crypto from "crypto";
import { hashPassword } from "./crypto.js";

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

function getDatabaseFilePath(): string {
  if (process.env.AUTH_HUB_DB_FILE) {
    return path.resolve(process.env.AUTH_HUB_DB_FILE);
  }
  const candidate1 = path.resolve(__dirname, "..", "data", "auth-store.json");
  if (fs.existsSync(candidate1)) return candidate1;

  const candidate2 = path.resolve(process.cwd(), "backend", "data", "auth-store.json");
  if (fs.existsSync(candidate2)) return candidate2;

  const candidate3 = path.resolve(process.cwd(), "data", "auth-store.json");
  if (fs.existsSync(candidate3)) return candidate3;

  return candidate1;
}

const DB_FILE = getDatabaseFilePath();

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

function createInitialData(): AuthHubSchema {
  const now = new Date().toISOString();
  const defaultPassHash = hashPassword("admin123");
  const devPassHash = hashPassword("dev123");
  const clientPassHash = hashPassword("client123");

  const clients: OAuthClient[] = [
    {
      id: "app_minihost",
      name: "Mini VPS Panel",
      slug: "minihost",
      description: "Cloud VPS KVM, Docker Apps, Raspberry Pi 5 Telemetry & Billing Panel",
      icon: "⚡",
      clientId: "ah_client_minihost_9f8a7b",
      clientSecret: "ah_secret_minihost_e4d2c1b0a9f8e7d6c5b4a3",
      redirectUris: [
        "https://panel.josapratama.com/auth/callback",
        "http://localhost:3001/auth/callback",
      ],
      homepageUrl: "https://panel.josapratama.com",
      techStack: "Next.js + Python FastAPI",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_polyglot",
      name: "Polyglot Hub",
      slug: "polyglot-hub",
      description: "Enterprise Translation Management System (TMS) & Build-Time i18n Sync",
      icon: "🌐",
      clientId: "ah_client_polyglot_3c4d5e",
      clientSecret: "ah_secret_polyglot_7f8e9d0c1b2a3f4e5d6c7b",
      redirectUris: [
        "https://polyglot.josapratama.com/auth/callback",
        "http://localhost:4000/auth/callback",
      ],
      homepageUrl: "http://localhost:4000",
      techStack: "Vue 3 + Express TS",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_uploadbox",
      name: "UploadBox CDN",
      slug: "uploadbox",
      description: "Cloud Object Storage, Image Transformation CDN & File Sharing Hub",
      icon: "📦",
      clientId: "ah_client_uploadbox_1a2b3c",
      clientSecret: "ah_secret_uploadbox_9a8b7c6d5e4f3a2b1c0d9e",
      redirectUris: [
        "https://cdn.josapratama.com/auth/callback",
        "http://localhost:5001/auth/callback",
      ],
      homepageUrl: "https://cdn.josapratama.com",
      techStack: "React + Node.js Express",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_wabridge",
      name: "WABridge Gateway",
      slug: "wabridge",
      description: "Multi-Device WhatsApp API Gateway, Webhook Automation & OTP Dispatcher",
      icon: "📱",
      clientId: "ah_client_wabridge_6d7e8f",
      clientSecret: "ah_secret_wabridge_2b3c4d5e6f7a8b9c0d1e2f",
      redirectUris: [
        "https://wa.josapratama.com/auth/callback",
        "http://localhost:5002/auth/callback",
      ],
      homepageUrl: "https://wa.josapratama.com",
      techStack: "Next.js + Baileys Node API",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_nexus",
      name: "Nexus Chat",
      slug: "nexus-chat",
      description: "Real-Time Encrypted Team Messaging, Channels & Presence Engine",
      icon: "💬",
      clientId: "ah_client_nexus_4e5f6a",
      clientSecret: "ah_secret_nexus_8c7b6a5f4e3d2c1b0a9f8e",
      redirectUris: [
        "https://chat.josapratama.com/auth/callback",
        "http://localhost:5003/auth/callback",
      ],
      homepageUrl: "https://chat.josapratama.com",
      techStack: "Vue + Socket.io + Express",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_umlflow",
      name: "UML Flow Studio",
      slug: "uml-flow",
      description: "Collaborative Architecture Diagramming, ERD & Sequence Designer",
      icon: "📐",
      clientId: "ah_client_umlflow_7b8c9d",
      clientSecret: "ah_secret_umlflow_5f6e7d8c9b0a1f2e3d4c5b",
      redirectUris: [
        "https://uml.josapratama.com/auth/callback",
        "http://localhost:5004/auth/callback",
      ],
      homepageUrl: "https://uml.josapratama.com",
      techStack: "React + Canvas Engine",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_arsip",
      name: "Arsip Digital",
      slug: "arsip-digital",
      description: "Document Management System, E-Archive Indexing & Approval Workflow",
      icon: "🗂️",
      clientId: "ah_client_arsip_2c3d4e",
      clientSecret: "ah_secret_arsip_1d2e3f4a5b6c7d8e9f0a1b",
      redirectUris: [
        "https://arsip.josapratama.com/auth/callback",
        "http://localhost:5005/auth/callback",
      ],
      homepageUrl: "https://arsip.josapratama.com",
      techStack: "Fullstack Web App",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_irma",
      name: "Irma Iryani Platform",
      slug: "irma-iryani",
      description: "Dedicated Business Portal, Client Management & Content Platform",
      icon: "🌸",
      clientId: "ah_client_irma_5a6b7c",
      clientSecret: "ah_secret_irma_6c7d8e9f0a1b2c3d4e5f6a",
      redirectUris: [
        "https://irma.josapratama.com/auth/callback",
        "http://localhost:5006/auth/callback",
      ],
      homepageUrl: "https://irma.josapratama.com",
      techStack: "Frontend + REST Backend",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_portfolio",
      name: "Portfolio CMS & API",
      slug: "portfolio",
      description: "Personal Brand Showcase, Blog Engine & Project Analytics",
      icon: "🎨",
      clientId: "ah_client_portfolio_8d9e0f",
      clientSecret: "ah_secret_portfolio_3e4f5a6b7c8d9e0f1a2b3c",
      redirectUris: [
        "https://josapratama.com/auth/callback",
        "http://localhost:5007/auth/callback",
      ],
      homepageUrl: "https://josapratama.com",
      techStack: "Next.js + Portfolio API",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "app_guidepath",
      name: "GuidePath Thesis & AI Research",
      slug: "guidepath",
      description: "Thesis Guidance Platform, Milestone Tracking, AI Research Gap & SINTA Journal Indexer",
      icon: "🎓",
      clientId: "ah_client_guidepath_7f8a9b",
      clientSecret: "ah_secret_guidepath_4c5d6e7f8a9b0c1d2e3f4a",
      redirectUris: [
        "https://guidepath.josapratama.com/auth/callback",
        "http://localhost:8000/auth/callback",
      ],
      homepageUrl: "https://guidepath.josapratama.com",
      techStack: "Laravel 11 + Inertia React",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const users: AuthUser[] = [
    {
      id: "usr_josa_root",
      email: "josapratama@minihost.local",
      username: "josapratama",
      name: "Josa Pratama",
      passwordHash: defaultPassHash,
      globalRole: "superadmin",
      appRoles: {
        minihost: "superadmin",
        "polyglot-hub": "superadmin",
        uploadbox: "superadmin",
        wabridge: "superadmin",
        "nexus-chat": "superadmin",
        "uml-flow": "superadmin",
        "arsip-digital": "superadmin",
        "irma-iryani": "superadmin",
        portfolio: "superadmin",
        guidepath: "superadmin",
      },
      twoFactorEnabled: false,
      twoFactorSecret: "JOSA2FASECRETKEY2026",
      phoneWhatsapp: "6281234567890",
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const settings: AuthHubSettings = {
    allowPublicRegistration: true,
    requireAdminApproval: false,
    defaultMemberRole: "member",
    publicClientSlugs: ["guidepath", "nexus-chat", "polyglot-hub", "portfolio", "uploadbox", "uml-flow"],
  };

  return {
    settings,
    clients,
    users,
    authCodes: [],
    sessions: [],
    auditLogs: [],
  };
}

class AuthHubDatabase {
  private data: AuthHubSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): AuthHubSchema {
    ensureDirectoryExistence(DB_FILE);
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed: AuthHubSchema = JSON.parse(raw);

      // Remove any legacy dummy users if present
      parsed.users = (parsed.users || []).filter(
        (u) =>
          u.id !== "usr_dev_team" &&
          u.id !== "usr_client_irma" &&
          !u.email.includes("developer@minihost") &&
          !u.email.includes("client@minihost")
      );

      // Remove initial dummy audit logs
      parsed.auditLogs = (parsed.auditLogs || []).filter(
        (a) => a.id !== "aud_init_1" && a.id !== "aud_init_2"
      );

      // Ensure guidepath client exists
      if (!parsed.clients.some((c) => c.slug === "guidepath")) {
        const now = new Date().toISOString();
        parsed.clients.push({
          id: "app_guidepath",
          name: "GuidePath Thesis & AI Research",
          slug: "guidepath",
          description: "Thesis Guidance Platform, Milestone Tracking, AI Research Gap & SINTA Journal Indexer",
          icon: "🎓",
          clientId: "ah_client_guidepath_7f8a9b",
          clientSecret: "ah_secret_guidepath_4c5d6e7f8a9b0c1d2e3f4a",
          redirectUris: [
            "https://guidepath.josapratama.com/auth/callback",
            "http://localhost:8000/auth/callback",
          ],
          homepageUrl: "https://guidepath.josapratama.com",
          techStack: "Laravel 11 + Inertia React",
          require2FA: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        // Ensure root superadmin has guidepath access
        const root = parsed.users.find((u) => u.id === "usr_josa_root");
        if (root && root.appRoles) {
          root.appRoles.guidepath = "superadmin";
        }
      }

      if (!parsed.settings) {
        parsed.settings = {
          allowPublicRegistration: true,
          requireAdminApproval: false,
          defaultMemberRole: "member",
          publicClientSlugs: ["guidepath", "nexus-chat", "polyglot-hub", "portfolio", "uploadbox", "uml-flow"],
        };
      } else if (!parsed.settings.publicClientSlugs.includes("guidepath")) {
        parsed.settings.publicClientSlugs.push("guidepath");
      }

      this.data = parsed;
      this.save();
      return parsed;
    } catch {
      const initial = createInitialData();
      return initial;
    }
  }

  public save() {
    ensureDirectoryExistence(DB_FILE);
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
  }

  // ─── Settings ──────────────────────────────────────────────
  public getSettings(): AuthHubSettings {
    if (!this.data.settings) {
      this.data.settings = {
        allowPublicRegistration: true,
        requireAdminApproval: false,
        defaultMemberRole: "member",
        publicClientSlugs: ["nexus-chat", "polyglot-hub", "portfolio", "uploadbox", "uml-flow"],
      };
      this.save();
    }
    return this.data.settings;
  }

  public updateSettings(partial: Partial<AuthHubSettings>): AuthHubSettings {
    const current = this.getSettings();
    this.data.settings = {
      ...current,
      ...partial,
    };
    this.save();
    return this.data.settings;
  }

  // ─── Clients ───────────────────────────────────────────────
  public getClients(): OAuthClient[] {
    return this.data.clients;
  }

  public getClientBySlugOrId(idOrSlug: string): OAuthClient | undefined {
    return this.data.clients.find(
      (c) =>
        c.id === idOrSlug ||
        c.slug === idOrSlug ||
        c.clientId === idOrSlug
    );
  }

  public createClient(payload: {
    name: string;
    slug: string;
    description: string;
    icon?: string;
    homepageUrl?: string;
    redirectUris?: string[];
    techStack?: string;
  }): OAuthClient {
    const now = new Date().toISOString();
    const cleanSlug = payload.slug.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const randHex = crypto.randomBytes(3).toString("hex");
    const secretHex = crypto.randomBytes(14).toString("hex");

    const client: OAuthClient = {
      id: `app_${cleanSlug}_${randHex}`,
      name: payload.name,
      slug: cleanSlug,
      description: payload.description || "",
      icon: payload.icon || "🚀",
      clientId: `ah_client_${cleanSlug}_${randHex}`,
      clientSecret: `ah_secret_${cleanSlug}_${secretHex}`,
      redirectUris: payload.redirectUris?.length
        ? payload.redirectUris
        : [`http://localhost:3000/auth/callback`],
      homepageUrl: payload.homepageUrl || "http://localhost:3000",
      techStack: payload.techStack || "Fullstack App",
      require2FA: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.data.clients.push(client);

    // Automatically grant superadmin users access to new client
    for (const user of this.data.users) {
      if (user.globalRole === "superadmin") {
        user.appRoles[cleanSlug] = "superadmin";
      } else {
        user.appRoles[cleanSlug] = "viewer";
      }
    }

    this.save();
    return client;
  }

  public rotateClientSecret(idOrSlug: string): OAuthClient | undefined {
    const client = this.getClientBySlugOrId(idOrSlug);
    if (!client) return undefined;
    const secretHex = crypto.randomBytes(14).toString("hex");
    client.clientSecret = `ah_secret_${client.slug}_${secretHex}`;
    client.updatedAt = new Date().toISOString();
    this.save();
    return client;
  }

  public deleteClient(idOrSlug: string): boolean {
    const before = this.data.clients.length;
    this.data.clients = this.data.clients.filter(
      (c) => c.id !== idOrSlug && c.slug !== idOrSlug
    );
    if (this.data.clients.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  // ─── Users ─────────────────────────────────────────────────
  public getUsers(): Omit<AuthUser, "passwordHash">[] {
    return this.data.users.map(({ passwordHash, ...rest }) => rest);
  }

  public findUserByIdentifier(identifier: string): AuthUser | undefined {
    const clean = identifier.trim().toLowerCase();
    return this.data.users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.id === identifier
    );
  }

  public createUser(payload: {
    email: string;
    username: string;
    name: string;
    password: string;
    globalRole?: "superadmin" | "admin" | "member";
    appRoles?: Record<string, AppRole>;
  }): Omit<AuthUser, "passwordHash"> {
    const now = new Date().toISOString();
    const defaultRoles: Record<string, AppRole> = {};
    for (const c of this.data.clients) {
      defaultRoles[c.slug] =
        payload.globalRole === "superadmin" ? "superadmin" : "viewer";
    }

    const newUser: AuthUser = {
      id: `usr_${crypto.randomBytes(4).toString("hex")}`,
      email: payload.email.trim().toLowerCase(),
      username: payload.username.trim().toLowerCase(),
      name: payload.name.trim(),
      passwordHash: hashPassword(payload.password),
      globalRole: payload.globalRole || "member",
      appRoles: { ...defaultRoles, ...(payload.appRoles || {}) },
      twoFactorEnabled: false,
      twoFactorSecret: crypto.randomBytes(10).toString("hex").toUpperCase(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(newUser);
    this.save();
    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  public registerUser(payload: {
    email: string;
    username: string;
    name: string;
    password: string;
  }): { user: Omit<AuthUser, "passwordHash">; requireApproval: boolean } {
    const settings = this.getSettings();
    const now = new Date().toISOString();
    const defaultRoles: Record<string, AppRole> = {};

    for (const c of this.data.clients) {
      if (settings.publicClientSlugs.includes(c.slug)) {
        defaultRoles[c.slug] = "viewer";
      } else {
        defaultRoles[c.slug] = "none";
      }
    }

    const isActive = !settings.requireAdminApproval;
    const newUser: AuthUser = {
      id: `usr_${crypto.randomBytes(4).toString("hex")}`,
      email: payload.email.trim().toLowerCase(),
      username: payload.username.trim().toLowerCase(),
      name: payload.name.trim(),
      passwordHash: hashPassword(payload.password),
      globalRole: "member",
      appRoles: defaultRoles,
      twoFactorEnabled: false,
      twoFactorSecret: crypto.randomBytes(10).toString("hex").toUpperCase(),
      isActive,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(newUser);
    this.save();
    const { passwordHash, ...safeUser } = newUser;
    return { user: safeUser, requireApproval: settings.requireAdminApproval };
  }

  public toggleUserActive(userId: string): Omit<AuthUser, "passwordHash"> | undefined {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return undefined;
    user.isActive = !user.isActive;
    user.updatedAt = new Date().toISOString();
    this.save();
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  public updateUserAppRole(
    userId: string,
    clientSlug: string,
    role: AppRole
  ): Omit<AuthUser, "passwordHash"> | undefined {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return undefined;
    user.appRoles[clientSlug] = role;
    user.updatedAt = new Date().toISOString();
    this.save();
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  public toggleUser2FA(userId: string): Omit<AuthUser, "passwordHash"> | undefined {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return undefined;
    user.twoFactorEnabled = !user.twoFactorEnabled;
    if (!user.twoFactorSecret) {
      user.twoFactorSecret = crypto.randomBytes(10).toString("hex").toUpperCase();
    }
    user.updatedAt = new Date().toISOString();
    this.save();
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  public deleteUser(userId: string): boolean {
    const before = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== userId);
    if (this.data.users.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  // ─── WebAuthn / YubiKey Hardware Credentials ─────────────────

  public addWebAuthnCredential(userId: string, cred: WebAuthnCredential): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    if (!user.webAuthnCredentials) {
      user.webAuthnCredentials = [];
    }
    user.webAuthnCredentials.push(cred);
    user.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  public updateWebAuthnCounter(userId: string, credId: string, newCounter: number): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user || !user.webAuthnCredentials) return false;
    const cred = user.webAuthnCredentials.find((c) => c.id === credId);
    if (!cred) return false;
    cred.counter = newCounter;
    user.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  public removeWebAuthnCredential(userId: string, credId: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user || !user.webAuthnCredentials) return false;
    const before = user.webAuthnCredentials.length;
    user.webAuthnCredentials = user.webAuthnCredentials.filter((c) => c.id !== credId);
    if (user.webAuthnCredentials.length < before) {
      user.updatedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }

  public findUserByCredentialId(credId: string): AuthUser | undefined {
    return this.data.users.find((u) =>
      u.webAuthnCredentials?.some((c) => c.id === credId)
    );
  }

  // ─── OAuth2 Authorization Codes ────────────────────────────
  public createAuthCode(payload: {
    userId: string;
    clientId: string;
    clientSlug: string;
    redirectUri: string;
    scopes: string[];
  }): AuthCodeRecord {
    const code = `ah_code_${crypto.randomBytes(16).toString("hex")}`;
    const record: AuthCodeRecord = {
      code,
      userId: payload.userId,
      clientId: payload.clientId,
      clientSlug: payload.clientSlug,
      redirectUri: payload.redirectUri,
      scopes: payload.scopes,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      used: false,
    };

    // Prune expired codes
    this.data.authCodes = this.data.authCodes.filter(
      (c) => c.expiresAt > Date.now() && !c.used
    );
    this.data.authCodes.push(record);
    this.save();
    return record;
  }

  public consumeAuthCode(code: string): AuthCodeRecord | undefined {
    const record = this.data.authCodes.find(
      (c) => c.code === code && !c.used && c.expiresAt > Date.now()
    );
    if (!record) return undefined;
    record.used = true;
    this.save();
    return record;
  }

  // ─── Sessions ──────────────────────────────────────────────
  public createSession(payload: {
    userId: string;
    userEmail: string;
    userName: string;
    clientSlug: string;
    clientName: string;
    appRole: AppRole;
    ipAddress: string;
    userAgent: string;
    ttlSeconds?: number;
  }): AuthSession {
    const ttl = payload.ttlSeconds || 86400;
    const now = new Date();
    const exp = new Date(now.getTime() + ttl * 1000);

    const session: AuthSession = {
      id: `sid_${crypto.randomBytes(10).toString("hex")}`,
      userId: payload.userId,
      userEmail: payload.userEmail,
      userName: payload.userName,
      clientSlug: payload.clientSlug,
      clientName: payload.clientName,
      appRole: payload.appRole,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      issuedAt: now.toISOString(),
      expiresAt: exp.toISOString(),
      revoked: false,
    };

    this.data.sessions.unshift(session);
    if (this.data.sessions.length > 100) {
      this.data.sessions = this.data.sessions.slice(0, 100);
    }
    this.save();
    return session;
  }

  public getSessions(): AuthSession[] {
    return this.data.sessions;
  }

  public getSessionById(sid: string): AuthSession | undefined {
    return this.data.sessions.find((s) => s.id === sid);
  }

  public revokeSession(sid: string): boolean {
    const session = this.data.sessions.find((s) => s.id === sid);
    if (!session) return false;
    session.revoked = true;
    this.save();
    return true;
  }

  public revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const s of this.data.sessions) {
      if (s.userId === userId && !s.revoked) {
        s.revoked = true;
        count++;
      }
    }
    if (count > 0) this.save();
    return count;
  }

  // ─── Audit Logs ────────────────────────────────────────────
  public addAuditLog(payload: Omit<AuditLog, "id" | "timestamp">): AuditLog {
    const entry: AuditLog = {
      id: `aud_${crypto.randomBytes(6).toString("hex")}`,
      timestamp: new Date().toISOString(),
      ...payload,
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 200);
    }
    this.save();
    return entry;
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }
}

export const db = new AuthHubDatabase();

