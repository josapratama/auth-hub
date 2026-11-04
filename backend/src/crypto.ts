import crypto from "crypto";

const JWT_SECRET =
  process.env.JWT_SECRET || "authhub-default-dev-secret-change-in-production";

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return Buffer.from(str, "base64").toString("utf8");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(originalHash, "hex")
  );
}

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  globalRole: string;
  clientId?: string;
  clientSlug?: string;
  appRole?: string;
  scopes?: string[];
  sid: string;
  iat?: number;
  exp?: number;
  iss?: string;
}

export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp" | "iss">,
  expiresInSeconds = 86400
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iss: process.env.AUTH_HUB_ISSUER || "auth-hub.josapratama.com",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(signatureInput)
    .digest();

  return `${signatureInput}.${base64UrlEncode(signature)}`;
}

export function verifyJwt(token: string): {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
} {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Malformed JWT structure" };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac("sha256", JWT_SECRET).update(signatureInput).digest()
    );

    if (signature !== expectedSig) {
      return { valid: false, error: "Invalid JWT cryptographic signature" };
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && now > payload.exp) {
      return { valid: false, error: "JWT token has expired" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || "Token verification failed" };
  }
}

/**
 * Generates a current 6-digit TOTP code from a hex/ascii secret (30-second window)
 */
export function generateTotpCode(secret: string, windowOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac("sha1", Buffer.from(secret, "utf8")).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const clean = String(code).trim();
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(secret, offset) === clean) {
      return true;
    }
  }
  return false;
}

