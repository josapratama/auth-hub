# 🛡️ AuthHub — Centralized Identity, SSO (OAuth2/JWT), YubiKey PIN & Multi-Project RBAC Engine

**AuthHub** adalah pusat autentikasi mandiri (*Self-Hosted Identity & Access Management / Single Sign-On*) yang dirancang khusus untuk ekosistem **Mini VPS Panel** dan seluruh aplikasi di dalam direktori `project/` (seperti `Polyglot Hub`, `UploadBox CDN`, `Nexus Chat`, `WABridge`, `UML Flow`, `Arsip Digital`, `Irma Iryani`, dan `Portfolio`).

Dilengkapi dukungan standar keamanan militer **FIDO2 / WebAuthn Hardware Security Key (YubiKey dengan proteksi PIN)**, **2FA TOTP**, **Public Self-Registration**, dan **Multi-Project RBAC Matrix**. Ringan, cepat (~35 MB RAM di Raspberry Pi 5), dan tanpa ketergantungan layanan cloud pihak ketiga.

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
4. **Hardware Key (YubiKey PIN / FIDO2):** Login tanpa risiko phishing menggunakan USB/NFC YubiKey dengan verifikasi User PIN hardware langsung pada browser.
5. **Global Logout (Kill-Switch):** Cabut sesi user dari dashboard AuthHub, maka akses user di seluruh aplikasi langsung dihentikan detik itu juga.

---

## 🛡️ Dukungan FIDO2 / WebAuthn Hardware Security Key (YubiKey + PIN)

AuthHub mengimplementasikan standar resmi **W3C WebAuthn / FIDO2** menggunakan `@simplewebauthn`:
- **User Verification (Required):** Setiap operasi autentikasi mewajibkan verifikasi **Hardware PIN YubiKey** lokal di perangkat sebelum assertion kriptografi diterbitkan.
- **Dukungan Perangkat:** YubiKey 5 Series (USB-A, USB-C, NFC), Security Key by Yubico, serta kompatibel dengan Passkey platform.
- **Kredensial Aman:** Tanda tangan publik asimetris (ECDSA/EdDSA) disimpan di backend dengan tracking counter untuk mencegah serangan *replay attack*.

### Endpoint WebAuthn:
- `POST /api/webauthn/register/options` (Generate ceremony options pendaftaran kunci)
- `POST /api/webauthn/register/verify` (Verifikasi dan simpan kredensial YubiKey)
- `GET /api/webauthn/keys` (Melihat daftar kunci terdaftar)
- `DELETE /api/webauthn/keys/:id` (Menghapus kunci)
- `POST /api/webauthn/login/options` (Opsi login publik via YubiKey)
- `POST /api/webauthn/login/verify` (Verifikasi login YubiKey PIN + Touch dan penerbitan sesi JWT)

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

## 🔒 Keamanan & Proteksi Portal Admin (Hardened v1.2)

Portal Admin AuthHub kini telah **diproteksi secara penuh (Full Zero-Trust Architecture)** agar aman dari berbagai potensi serangan siber:

1. **Multi-Faktor Autentikasi Fleksibel:**
   * Login password aman dengan hashing salt SHA-256.
   * Opsi 2FA TOTP (Google Authenticator / RFC 6238).
   * Opsi Hardware Token YubiKey (PIN + Touch) FIDO2.
   * Semua endpoint management (`/api/overview`, `/api/clients`, `/api/users`, `/api/sessions/revoke`, `/api/settings`) dilindungi oleh middleware `requireAdminAuth`.

2. **Perlindungan Serangan Brute-Force & Rate Limiting:**
   * Endpoint login Admin (`/api/admin/login`), pendaftaran (`/api/v1/auth/register`), dan SSO Authorize (`/api/v1/auth/authorize`) dilengkapi proteksi rate limiting berbasis IP dan identifier.
   * Batas maksimal 5 kali percobaan gagal sebelum akun/IP diblokir sementara (*temporary lockout*) selama 15 menit.

3. **Security Headers Standard Enterprise:**
   * `X-Content-Type-Options: nosniff` (mencegah MIME sniffing exploit)
   * `X-Frame-Options: SAMEORIGIN` (mencegah Clickjacking)
   * `X-XSS-Protection: 1; mode=block`
   * `Referrer-Policy: strict-origin-when-cross-origin`

4. **Audit Trail Lengkap:**
   * Setiap aktivitas penting (login admin, registrasi user, pendaftaran/penghapusan YubiKey, rotasi client secret, pemutusan sesi, perubahan role) dicatat ke dalam log audit dengan stempel IP address.

---

## 🔑 Inisialisasi Akun Awal (First-Time Setup)

Setelah instalasi atau menjalankan container, Anda dapat masuk ke Dashboard Admin menggunakan akun inisial:
- **Identifier:** `josapratama@minihost.local` atau `josapratama`
- **Role:** `superadmin` (Akses penuh ke seluruh 9 project ekosistem)

> [!IMPORTANT]
> **Praktik Keamanan Terbaik:**  
> 1. Segera ganti password akun admin atau daftarkan **Hardware Key (YubiKey + PIN)** / aktifkan **2FA TOTP** melalui menu pengguna setelah login pertama.
> 2. Di lingkungan produksi, atur `JWT_SECRET` yang kuat dan unik melalui file `.env`.
> 3. Jangan pernah mempublikasikan file `.env` atau database `auth-store.json` ke repositori publik.

