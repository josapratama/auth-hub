import { Router, type Response } from "express";
import { db } from "../db.js";
import { authMiddleware, requireAdmin, type AuthRequest } from "../middleware/auth.js";
import { getClientIp } from "../utils/rateLimit.js";

export const clientsRouter = Router();

// All client routes require admin auth
clientsRouter.use(authMiddleware);
clientsRouter.use(requireAdmin);

/**
 * GET /api/clients
 * List all registered OAuth2 clients
 */
clientsRouter.get("/", (_req: AuthRequest, res: Response) => {
  res.json({ clients: db.getClients() });
});

/**
 * POST /api/clients
 * Register a new OAuth2 client application
 */
clientsRouter.post("/", (req: AuthRequest, res: Response) => {
  const { name, slug, description, icon, redirectUris, homepageUrl, techStack } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: "Client Name and Slug are required" });
  }

  const existing = db.getClientBySlugOrId(slug);
  if (existing) {
    return res.status(409).json({ error: `Client with slug '${slug}' already exists` });
  }

  const client = db.createClient({
    name,
    slug,
    description: description || "",
    icon: icon || "🚀",
    homepageUrl,
    redirectUris: Array.isArray(redirectUris) ? redirectUris : [redirectUris].filter(Boolean),
    techStack,
  });

  db.addAuditLog({
    event: "CLIENT_CREATED",
    userEmail: req.user?.email || "admin",
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "success",
    details: `Registered new OAuth2 client: ${client.name} (${client.slug})`,
  });

  res.status(201).json({ client });
});

/**
 * POST /api/clients/:id/rotate-secret
 * Rotate client secret
 */
clientsRouter.post("/:id/rotate-secret", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const client = db.rotateClientSecret(targetId);
  if (!client) {
    return res.status(404).json({ error: "Client not found" });
  }

  db.addAuditLog({
    event: "CLIENT_SECRET_ROTATED",
    userEmail: req.user?.email || "admin",
    clientSlug: client.slug,
    ipAddress: getClientIp(req),
    status: "warning",
    details: `Rotated client_secret for ${client.name} (${client.slug})`,
  });

  res.json({ client });
});

/**
 * DELETE /api/clients/:id
 * Delete an OAuth2 client
 */
clientsRouter.delete("/:id", (req: AuthRequest, res: Response) => {
  const targetId = String(req.params.id);
  const client = db.getClientBySlugOrId(targetId);

  if (!client) {
    return res.status(404).json({ error: "Client not found" });
  }

  if (client.slug === "minihost" || client.slug === "guidepath") {
    return res.status(400).json({ error: "Cannot delete core ecosystem client applications" });
  }

  const deleted = db.deleteClient(targetId);
  if (deleted) {
    db.addAuditLog({
      event: "CLIENT_DELETED",
      userEmail: req.user?.email || "admin",
      clientSlug: client.slug,
      ipAddress: getClientIp(req),
      status: "danger",
      details: `Deleted OAuth2 client: ${client.name} (${client.slug})`,
    });
    return res.json({ success: true, message: "Client deleted successfully" });
  }

  res.status(500).json({ error: "Failed to delete client" });
});
