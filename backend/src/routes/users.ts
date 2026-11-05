import { Router, type Response } from "express";
import { db, type AppRole } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";
import { hashPassword } from "../crypto.js";

export const usersRouter = Router();

// Require admin auth for all user management
usersRouter.use(authMiddleware);
usersRouter.use(requireAdmin);

/**
 * GET /api/users
 * List all users with safe data
 */
usersRouter.get("/", (_req: AuthRequest, res: Response) => {
  res.json({ users: db.getUsers() });
});

/**
 * POST /api/users
 * Admin manually creates a new user
 */
usersRouter.post("/", (req: AuthRequest, res: Response) => {
  const { email, username, name, password, globalRole, appRoles, permissions } = req.body;

  if (!email || !username || !name || !password) {
    return res.status(400).json({ error: "Email, Username, Name, and Password are required" });
  }

  const existingEmail = db.findUserByIdentifier(email);
  const existingUsername = db.findUserByIdentifier(username);
  if (existingEmail || existingUsername) {
    return res.status(409).json({ error: "Email or Username already in use" });
  }

  const user = db.createUser({
    email,
    username,
    name,
    password,
    globalRole: globalRole || "member",
    appRoles,
    permissions,
  });

  db.addAuditLog({
    event: "USER_CREATED",
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: "success",
    details: `Admin ${req.user?.email} created user '${user.name}' (${user.email}) with role ${user.globalRole}`,
  });

  res.status(201).json({ user });
});

/**
 * POST /api/users/:id/toggle-active
 * Toggle user active/inactive status
 */
usersRouter.post("/:id/toggle-active", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserByIdentifier(targetId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.id === "usr_josa_root" || user.id === req.user?.sub) {
    return res.status(400).json({ error: "Cannot disable root superadmin or your own account" });
  }

  const updated = db.toggleUserActive(targetId);
  if (!updated) {
    return res.status(500).json({ error: "Failed to toggle status" });
  }

  db.addAuditLog({
    event: "USER_STATUS_TOGGLED",
    userEmail: updated.email,
    ipAddress: getClientIp(req),
    status: updated.isActive ? "success" : "warning",
    details: `User ${updated.email} status changed to ${updated.isActive ? "ACTIVE" : "INACTIVE/SUSPENDED"}`,
  });

  res.json({ user: updated });
});

/**
 * POST /api/users/:id/role
 * Update role in a specific client application or global role
 */
usersRouter.post("/:id/role", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const { clientSlug, role } = req.body;

  if (!clientSlug || !role) {
    return res.status(400).json({ error: "clientSlug and role are required" });
  }

  const user = db.findUserByIdentifier(targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = db.updateUserAppRole(targetId, clientSlug, role as AppRole);
  if (!updated) {
    return res.status(500).json({ error: "Failed to update role" });
  }

  db.addAuditLog({
    event: "ROLE_UPDATED",
    userEmail: updated.email,
    clientSlug,
    ipAddress: getClientIp(req),
    status: "info",
    details: `Updated role for ${updated.email} in ${clientSlug} to '${role.toUpperCase()}'`,
  });

  res.json({ user: updated });
});

/**
 * POST /api/users/:id/permissions
 * Update granular permissions for a client application
 */
usersRouter.post("/:id/permissions", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const { clientSlug, permissions } = req.body;

  if (!clientSlug || !Array.isArray(permissions)) {
    return res.status(400).json({ error: "clientSlug and permissions array are required" });
  }

  const user = db.findUserByIdentifier(targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const updated = db.updateUserPermissions(targetId, clientSlug, permissions);
  if (!updated) {
    return res.status(500).json({ error: "Failed to update permissions" });
  }

  db.addAuditLog({
    event: "ROLE_UPDATED",
    userEmail: updated.email,
    clientSlug,
    ipAddress: getClientIp(req),
    status: "info",
    details: `Updated granular permissions for ${updated.email} in ${clientSlug}: [${permissions.join(", ")}]`,
  });

  res.json({ user: updated });
});

/**
 * POST /api/users/:id/reset-password
 * Admin resets password for a user
 */
usersRouter.post("/:id/reset-password", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  const user = db.findUserByIdentifier(targetId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  db.save();

  db.addAuditLog({
    event: "SETTINGS_UPDATED",
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: "warning",
    details: `Password reset by administrator for ${user.email}`,
  });

  res.json({ success: true, message: `Password for ${user.email} updated successfully` });
});

/**
 * DELETE /api/users/:id
 * Delete a user
 */
usersRouter.delete("/:id", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const user = db.findUserByIdentifier(targetId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.id === "usr_josa_root" || user.id === req.user?.sub) {
    return res.status(400).json({ error: "Cannot delete root superadmin or your own active account" });
  }

  db.deleteUser(targetId);
  db.revokeAllUserSessions(targetId);

  db.addAuditLog({
    event: "SETTINGS_UPDATED",
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: "danger",
    details: `User ${user.email} permanently deleted by administrator`,
  });

  res.json({ success: true, message: "User deleted" });
});
