import { db } from "../db.js";
import type { AuthSession } from "../types.js";

export async function notifyBackchannelLogout(session: AuthSession) {
  const client = db.getClientBySlugOrId(session.clientSlug);
  if (!client || !client.backchannelLogoutUri) {
    return;
  }

  const payload = {
    event: "BACKCHANNEL_LOGOUT",
    sessionId: session.id,
    userId: session.userId,
    userEmail: session.userEmail,
    clientSlug: session.clientSlug,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(client.backchannelLogoutUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuthHub-Event": "session.revoked",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    db.addAuditLog({
      event: "BACKCHANNEL_LOGOUT_SENT",
      userEmail: session.userEmail,
      clientSlug: client.slug,
      ipAddress: "127.0.0.1",
      status: res.ok ? "success" : "warning",
      details: `Back-channel logout webhook ke ${client.backchannelLogoutUri} menghasilkan status ${res.status}`,
    });
  } catch (err: any) {
    db.addAuditLog({
      event: "BACKCHANNEL_LOGOUT_SENT",
      userEmail: session.userEmail,
      clientSlug: client.slug,
      ipAddress: "127.0.0.1",
      status: "warning",
      details: `Back-channel logout webhook ke ${client.backchannelLogoutUri} gagal: ${err.message}`,
    });
  }
}
