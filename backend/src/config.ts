import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT) || 4100;
export const JWT_SECRET = process.env.JWT_SECRET || "authhub-default-dev-secret-change-in-production";
export const AUTH_HUB_ISSUER = process.env.AUTH_HUB_ISSUER || "auth-hub.josapratama.com";

// WebAuthn / FIDO2 Relying Party Configuration
export const RP_NAME = process.env.RP_NAME || "AuthHub Security Key";
export const RP_ID = process.env.RP_ID || (process.env.NODE_ENV === "production" ? "josapratama.com" : "localhost");
export const EXPECTED_ORIGIN = (process.env.EXPECTED_ORIGIN || "").split(",").filter(Boolean);

if (EXPECTED_ORIGIN.length === 0) {
  EXPECTED_ORIGIN.push(
    "http://localhost:4100",
    "http://localhost:5173",
    "http://localhost:8000",
    "https://auth.josapratama.com",
    "https://panel.josapratama.com",
    "https://guidepath.josapratama.com"
  );
}

export function getDatabaseFilePath(): string {
  if (process.env.AUTH_HUB_DB_FILE) {
    return path.resolve(process.env.AUTH_HUB_DB_FILE);
  }
  const candidate1 = path.resolve(__dirname, "..", "data", "auth-store.json");
  const candidate2 = path.resolve(process.cwd(), "backend", "data", "auth-store.json");
  const candidate3 = path.resolve(process.cwd(), "data", "auth-store.json");

  return candidate1;
}
