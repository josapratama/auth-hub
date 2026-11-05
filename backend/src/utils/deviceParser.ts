import type { Request } from "express";
import type { SessionDeviceInfo } from "../types.js";
import { getClientIp } from "./rateLimit.js";

export function parseDeviceInfo(req: Request): SessionDeviceInfo {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ip = getClientIp(req);

  // 1. Detect Browser
  let browser = "Web Browser";
  if (ua.includes("edg/")) browser = "Microsoft Edge";
  else if (ua.includes("chrome") && !ua.includes("chromium")) browser = "Google Chrome";
  else if (ua.includes("firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Apple Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";
  else if (ua.includes("curl")) browser = "cURL Terminal";
  else if (ua.includes("postman")) browser = "Postman Client";

  // 2. Detect OS
  let os = "Unknown OS";
  if (ua.includes("win")) os = "Windows 11 / 10";
  else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";

  // 3. Detect Device Form Factor
  let device = "Desktop PC";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    device = "Smartphone";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    device = "Tablet";
  }

  // 4. Determine Location / Network
  let location = "Jaringan Lokal / Private VPS";
  const cfCountry = req.headers["cf-ipcountry"];
  if (typeof cfCountry === "string" && cfCountry) {
    location = `${cfCountry.toUpperCase()} (Cloudflare CDN)`;
  } else if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.") || ip === "127.0.0.1" || ip === "::1") {
    location = "LAN / Local Host";
  } else {
    location = "Indonesia (Public IP)";
  }

  return {
    browser,
    os,
    device,
    ip,
    location,
  };
}
