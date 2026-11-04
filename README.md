# 🛡️ AuthHub — Centralized Identity, SSO (OAuth2/JWT) & Multi-Project RBAC Engine

**AuthHub** adalah pusat autentikasi mandiri (*Self-Hosted Identity & Access Management / Single Sign-On*) yang dirancang khusus untuk ekosistem **Mini VPS Panel** dan seluruh aplikasi di dalam direktori `project/` (seperti `Polyglot Hub`, `UploadBox CDN`, `Nexus Chat`, `WABridge`, `UML Flow`, `Arsip Digital`, `Irma Iryani`, dan `Portfolio`).

Ringan, cepat (~35 MB RAM di Raspberry Pi 5), dan tanpa ketergantungan layanan cloud berbayar (seperti Auth0/Clerk).

---

## 🔄 Bagaimana Cara Kerja AuthHub? (Alur Single Sign-On / OAuth2)

```
┌──────────────────────┐       1. Klik "Login with AuthHub"       ┌──────────────────────┐
│  Aplikasi Ekosistem  │ ───────────────────────────────────────► │       AuthHub        │
│ (Mini VPS, UploadBox │                                          │  (Identity Provider) │
│  WABridge, Polyglot) │ ◄─────────────────────────────────────── │  Port 4100 / SSO UI  │
└──────────┬───────────┘       2. Redirect + Authorization Code   └──────────▲───────────┘
           │                                                                 │
           │ 3. Backend menukar Code + Client Secret                         │
           └─────────────────────────────────────────────────────────────────┘
                               4. AuthHub membalas JWT Token
                           (Berisi Profil User + Role Khusus App)
```

1. **Satu Akun untuk Semua Aplikasi:** Pengguna cukup login satu kali di **AuthHub**.
2. **Matriks Role per Project (RBAC):** Di dashboard AuthHub, Admin dapat mengatur role user per aplikasi (`superadmin`, `admin`, `editor`, `viewer`, atau `none` / blokir akses).
3. **Standar OAuth2 + JWT:** Mendukung pertukaran `authorization_code` ke `access_token` (JWT HMAC-SHA256) dan endpoint `/api/v1/auth/verify` untuk verifikasi instan dari backend Python (FastAPI) maupun Node.js (Express).
4. **Global Logout (Kill-Switch):** Cabut sesi user dari dashboard AuthHub, maka akses user di seluruh aplikasi langsung dihentikan detik itu juga.

---

## 🚀 Cara Menjalankan

### Menggunakan Docker Compose (Produksi / Raspberry Pi 5)
```bash
docker compose up -d --build
```
Akses Dashboard & Simulator SSO di: `http://localhost:4100`

### Mode Development
```bash
# Terminal 1 (Backend Port 4100)
cd backend && npm install && npm run dev

# Terminal 2 (Frontend Vite Port 3002)
cd frontend && npm install && npm run dev
```

---

## 🔒 Keamanan & Proteksi Portal Admin (Hardened v1.1)

Portal Admin AuthHub kini telah **diproteksi secara penuh (Full Zero-Trust Architecture)** agar aman dari berbagai potensi serangan siber:

1. **Autentikasi Admin Terpusat (Admin JWT Auth):**
   * Mengakses dashboard `http://localhost:4100` kini mewajibkan login Admin.
   * Semua endpoint management (`/api/overview`, `/api/clients`, `/api/users`, `/api/sessions/revoke`, `/api/audit-logs`) dilindungi oleh middleware `requireAdminAuth`.
   * Hanya pengguna berstatus `superadmin` atau `admin` yang dapat mengakses portal.
   * Mendukung opsi verifikasi dua langkah (2FA TOTP Authenticator).

2. **Perlindungan Serangan Brute-Force & Rate Limiting:**
   * Endpoint login Admin (`/api/admin/login`) dan endpoint SSO Authorize (`/api/v1/auth/authorize`) dilengkapi proteksi rate limiting berbasis IP dan identifier.
   * Batas maksimal 5 kali percobaan gagal sebelum akun/IP diblokir sementara (*temporary lockout*) selama 15 menit.

3. **Security Headers Standard Enterprise:**
   * `X-Content-Type-Options: nosniff` (mencegah MIME sniffing exploit)
   * `X-Frame-Options: SAMEORIGIN` (mencegah Clickjacking)
   * `X-XSS-Protection: 1; mode=block`
   * `Referrer-Policy: strict-origin-when-cross-origin`

4. **Audit Trail Lengkap:**
   * Setiap aktivitas penting (login admin berhasil/gagal, logout, rotasi client secret, pemutusan sesi, perubahan role) dicatat ke dalam log audit dengan stempel IP address.

---

## 🔑 Inisialisasi Akun Awal (First-Time Setup)

Setelah instalasi atau menjalankan container, Anda dapat masuk ke Dashboard Admin menggunakan akun inisial:
- **Identifier:** `josapratama@minihost.local` atau `josapratama`
- **Role:** `superadmin` (Akses penuh ke seluruh 9 project ekosistem)

> [!IMPORTANT]
> **Praktik Keamanan Terbaik:**  
> 1. Segera ganti password akun admin atau aktifkan **2FA TOTP (Google Authenticator)** melalui menu pengguna setelah login pertama.
> 2. Di lingkungan produksi, atur `JWT_SECRET` yang kuat dan unik melalui file `.env`.
> 3. Jangan pernah mempublikasikan file `.env` atau database `auth-store.json` ke repositori publik.

