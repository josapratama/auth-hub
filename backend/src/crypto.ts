import crypto from "crypto";
import fs from "fs";
import path from "path";

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

// ─── RSA Keypair Management for JWKS & RS256 ─────────────────
const RSA_KEY_ID = "authhub-rsa-2026";
let rsaPrivateKey: crypto.KeyObject;
let rsaPublicKey: crypto.KeyObject;

function initRsaKeypair() {
  const keyFilePath = path.resolve(process.cwd(), "data", "rsa-keys.json");
  const dirname = path.dirname(keyFilePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }

  if (fs.existsSync(keyFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(keyFilePath, "utf-8"));
      rsaPrivateKey = crypto.createPrivateKey(data.privateKeyPem);
      rsaPublicKey = crypto.createPublicKey(data.publicKeyPem);
      return;
    } catch {
      // Regenerate if corrupted
    }
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  fs.writeFileSync(
    keyFilePath,
    JSON.stringify({ privateKeyPem: privateKey, publicKeyPem: publicKey }, null, 2),
    "utf-8"
  );

  rsaPrivateKey = crypto.createPrivateKey(privateKey);
  rsaPublicKey = crypto.createPublicKey(publicKey);
}

initRsaKeypair();

export function getPublicJwks() {
  const jwk = rsaPublicKey.export({ format: "jwk" });
  return {
    keys: [
      {
        ...jwk,
        kid: RSA_KEY_ID,
        use: "sig",
        alg: "RS256",
      },
    ],
  };
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
  permissions?: string[];
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
    iss: process.env.AUTH_HUB_ISSUER || "https://auth.josapratama.com",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: "RS256", typ: "JWT", kid: RSA_KEY_ID };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  signer.end();
  const signature = signer.sign(rsaPrivateKey);

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

    const [encodedHeader, encodedPayload, signatureB64] = parts;
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = Buffer.from(signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    if (header.alg === "RS256") {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(signatureInput);
      verifier.end();
      if (!verifier.verify(rsaPublicKey, signature)) {
        return { valid: false, error: "Invalid RS256 cryptographic signature" };
      }
    } else {
      // Fallback for HS256 tokens
      const expectedSig = base64UrlEncode(
        crypto.createHmac("sha256", JWT_SECRET).update(signatureInput).digest()
      );
      if (signatureB64 !== expectedSig) {
        return { valid: false, error: "Invalid HS256 signature" };
      }
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
