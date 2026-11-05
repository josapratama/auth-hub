import fs from "fs";
import path from "path";
import crypto from "crypto";
import { hashPassword } from "./crypto.js";
import { getDatabaseFilePath } from "./config.js";
import { createInitialData } from "./seed.js";
import type {
  AppRole,
  OAuthClient,
  WebAuthnCredential,
  AuthUser,
  AuthCodeRecord,
  AuthSession,
  AuditLog,
  AuthHubSettings,
  AuthHubSchema,
} from "./types.js";

const DB_FILE = getDatabaseFilePath();

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

export class AuthHubDatabase {
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
        publicClientSlugs: ["guidepath", "nexus-chat", "polyglot-hub", "portfolio", "uploadbox", "uml-flow"],
      };
      this.save();
    } else if (!this.data.settings.publicClientSlugs.includes("guidepath")) {
      this.data.settings.publicClientSlugs.push("guidepath");
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
export * from "./types.js";
