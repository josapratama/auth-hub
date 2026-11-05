<script setup lang="ts">
import { ref, onMounted } from "vue";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const emit = defineEmits(["login-success"]);
const { setAuth } = useAuth();
const { showToast } = useToast();

const authTab = ref<"login" | "register">("login");
const loginMode = ref<"password" | "yubikey">("password");

// OAuth query parameters
interface OAuthClientInfo {
  clientId: string;
  slug: string;
  name: string;
  icon: string;
  redirectUri: string;
  state: string;
}
const oauthClientInfo = ref<OAuthClientInfo | null>(null);

// Password login form
const loginForm = ref({
  identifier: "",
  password: "",
  totpCode: "",
});
const loginLoading = ref(false);
const loginError = ref("");
const loginRequire2fa = ref(false);
const loginDemoTotp = ref("");

// YubiKey login state
const yubikeyIdentifier = ref("");
const yubikeyLoading = ref(false);
const yubikeyError = ref("");
const supportsWebAuthn = ref(true);

// Registration form
const regForm = ref({
  name: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
});
const regLoading = ref(false);
const regError = ref("");
const regSuccessMessage = ref("");

onMounted(() => {
  supportsWebAuthn.value = browserSupportsWebAuthn();

  // Parse OAuth parameters from current URL
  const params = new URLSearchParams(window.location.search);
  const isOauth = params.get("oauth") === "1" || params.has("client_id") || params.has("client_slug");
  if (isOauth) {
    oauthClientInfo.value = {
      clientId: params.get("client_id") || "",
      slug: params.get("client_slug") || "guidepath",
      name: params.get("client_name") || "Aplikasi Mitra AuthHub",
      icon: params.get("client_icon") || "🎓",
      redirectUri: params.get("redirect_uri") || "",
      state: params.get("state") || "sso",
    };
  }
});

function fillDemoAdmin() {
  loginForm.value.identifier = "josapratama@minihost.local";
  loginForm.value.password = "admin123";
  loginMode.value = "password";
}

async function handleLogin() {
  loginLoading.value = true;
  loginError.value = "";
  loginDemoTotp.value = "";

  // 1. If OAuth SSO Request (e.g. from GuidePath)
  if (oauthClientInfo.value) {
    try {
      const res = await fetch("/api/v1/auth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginForm.value.identifier,
          password: loginForm.value.password,
          totpCode: loginForm.value.totpCode,
          clientId: oauthClientInfo.value.clientId || oauthClientInfo.value.slug,
          clientSlug: oauthClientInfo.value.slug,
          redirectUri: oauthClientInfo.value.redirectUri,
          state: oauthClientInfo.value.state,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        loginError.value = data.error || "Autentikasi SSO gagal.";
        if (data.require2FA) {
          loginRequire2fa.value = true;
          loginDemoTotp.value = data.demoHint || "";
        }
        return;
      }

      if (data.redirectUri) {
        showToast(`✅ Otorisasi sukses! Mengalihkan ke ${oauthClientInfo.value.name}...`);
        setTimeout(() => {
          window.location.href = data.redirectUri;
        }, 500);
        return;
      }
    } catch (err: any) {
      loginError.value = err.message || "Gagal menghubungi server SSO.";
    } finally {
      loginLoading.value = false;
    }
    return;
  }

  // 2. Direct Admin Dashboard Login
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm.value),
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.value = data.error || "Login gagal";
      if (data.require2FA) {
        loginRequire2fa.value = true;
        loginDemoTotp.value = data.demoHint || "";
      }
      return;
    }

    setAuth(data.token, data.user);
    showToast(`Selamat datang kembali, ${data.user.name}!`);
    emit("login-success", data.user);
  } catch (err: any) {
    loginError.value = err.message || "Gagal menghubungi server.";
  } finally {
    loginLoading.value = false;
  }
}

async function handleYubiKeyLogin() {
  yubikeyLoading.value = true;
  yubikeyError.value = "";

  try {
    // 1. Get Authentication Challenge Options
    const optRes = await fetch("/api/webauthn/login/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: yubikeyIdentifier.value || undefined }),
    });

    const optData = await optRes.json();
    if (!optRes.ok) {
      yubikeyError.value = optData.error || "Gagal memulai otentikasi YubiKey.";
      return;
    }

    // 2. Prompt native WebAuthn (YubiKey PIN + Touch)
    const asseResp = await startAuthentication(optData.options);

    // 3. Verify on backend
    const verifyRes = await fetch("/api/webauthn/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeSessionId: optData.challengeSessionId,
        response: asseResp,
        clientSlug: oauthClientInfo.value?.slug,
        clientId: oauthClientInfo.value?.clientId,
        redirectUri: oauthClientInfo.value?.redirectUri,
        state: oauthClientInfo.value?.state,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      yubikeyError.value = verifyData.error || "Verifikasi YubiKey ditolak.";
      return;
    }

    setAuth(verifyData.token, verifyData.user);
    showToast(verifyData.message || "✅ Login dengan YubiKey (PIN Terverifikasi) Berhasil!");

    if (verifyData.redirectUri) {
      showToast(`✅ YubiKey Terverifikasi! Mengalihkan ke ${oauthClientInfo.value?.name || "aplikasi"}...`);
      setTimeout(() => {
        window.location.href = verifyData.redirectUri;
      }, 600);
      return;
    }

    emit("login-success", verifyData.user);
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      yubikeyError.value = "Operasi dibatalkan atau PIN salah / waktu habis.";
    } else {
      yubikeyError.value = err.message || "Otentikasi YubiKey gagal.";
    }
  } finally {
    yubikeyLoading.value = false;
  }
}

async function handleRegister() {
  regError.value = "";
  regSuccessMessage.value = "";

  if (!regForm.value.name || !regForm.value.email || !regForm.value.username || !regForm.value.password) {
    regError.value = "Semua kolom wajib diisi.";
    return;
  }
  if (regForm.value.password.length < 6) {
    regError.value = "Password minimal 6 karakter.";
    return;
  }
  if (regForm.value.password !== regForm.value.confirmPassword) {
    regError.value = "Konfirmasi password tidak cocok.";
    return;
  }

  regLoading.value = true;
  try {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: regForm.value.name,
        email: regForm.value.email,
        username: regForm.value.username,
        password: regForm.value.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      regError.value = data.error || "Pendaftaran gagal.";
      return;
    }

    regSuccessMessage.value = data.message || "Pendaftaran akun berhasil!";
    const registeredUser = regForm.value.username || regForm.value.email;
    regForm.value = { name: "", email: "", username: "", password: "", confirmPassword: "" };

    if (!data.requireApproval) {
      showToast("Pendaftaran sukses! Silakan masuk dengan akun baru.");
      loginForm.value.identifier = registeredUser;
      setTimeout(() => {
        authTab.value = "login";
      }, 1200);
    }
  } catch (err: any) {
    regError.value = err.message || "Gagal menghubungi server.";
  } finally {
    regLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-4.5rem)] flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
    <div class="w-full max-w-md sm:max-w-lg space-y-4 sm:space-y-6">
      
      <!-- OAuth Client Request Banner (if redirected from GuidePath or others) -->
      <div
        v-if="oauthClientInfo"
        class="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-violet-950/80 border border-indigo-500/40 shadow-xl shadow-indigo-950/40 flex items-center gap-3.5"
      >
        <div class="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0">
          {{ oauthClientInfo.icon }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Permintaan Masuk SSO
          </div>
          <div class="text-sm font-bold text-white truncate">
            {{ oauthClientInfo.name }}
          </div>
          <p class="text-[11px] text-slate-400 truncate">
            Identitas Anda akan dibagikan dengan aman via token JWT
          </p>
        </div>
      </div>

      <!-- Main Auth Card -->
      <div class="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-6">
        
        <!-- Header & Tab Switcher (Login vs Register) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {{ authTab === 'login' ? 'Masuk ke Akun Anda' : 'Daftar Akun Baru' }}
              </h1>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ authTab === 'login' ? 'Gunakan password atau kunci fisik YubiKey PIN' : 'Buat identitas SSO baru untuk ekosistem' }}
              </p>
            </div>
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg">
              🔐
            </div>
          </div>

          <!-- Tab Button Toggle -->
          <div class="p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-2 gap-1 text-xs font-bold">
            <button
              type="button"
              @click="authTab = 'login'"
              class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="authTab === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >
              <span>🔑 Masuk (Login)</span>
            </button>
            <button
              type="button"
              @click="authTab = 'register'"
              class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="authTab === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >
              <span>✨ Daftar Akun Baru</span>
            </button>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- TAB 1: LOGIN (PASSWORD & YUBIKEY PIN)                      -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div v-if="authTab === 'login'" class="space-y-5">
          <!-- Method Toggle: Password vs YubiKey -->
          <div class="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs font-semibold">
            <button
              type="button"
              @click="loginMode = 'password'"
              class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="loginMode === 'password' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'"
            >
              <span>🔑 Password & 2FA</span>
            </button>
            <button
              type="button"
              @click="loginMode = 'yubikey'"
              class="py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="loginMode === 'yubikey' ? 'bg-gradient-to-r from-violet-600/40 to-emerald-600/40 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200'"
            >
              <span>🛡️ YubiKey (PIN)</span>
            </button>
          </div>

          <!-- ─── SUB-MODE A: PASSWORD LOGIN ─── -->
          <form v-if="loginMode === 'password'" @submit.prevent="handleLogin" class="space-y-4">
            <div v-if="loginError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
              <span class="text-base shrink-0">⚠️</span>
              <div>
                <p class="font-bold">Gagal Masuk</p>
                <p class="leading-relaxed">{{ loginError }}</p>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-300">Email atau Username SSO</label>
              <input
                v-model="loginForm.identifier"
                type="text"
                required
                autocomplete="username"
                placeholder="nama@domain.com atau username"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-300">Password</label>
              <input
                v-model="loginForm.password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <!-- 2FA TOTP input (if enabled) -->
            <div v-if="loginRequire2fa" class="space-y-1.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <label class="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>Kode 2FA Authenticator</span>
                <span v-if="loginDemoTotp" class="font-mono text-[11px] text-amber-400">Demo Code: {{ loginDemoTotp }}</span>
              </label>
              <input
                v-model="loginForm.totpCode"
                type="text"
                maxlength="6"
                placeholder="6-digit code"
                class="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-center font-mono tracking-widest text-base focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              :disabled="loginLoading"
              class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span v-if="loginLoading" class="animate-spin text-base">⏳</span>
              <span v-else>🛡️</span>
              <span>
                {{
                  loginLoading
                    ? 'Memverifikasi...'
                    : oauthClientInfo
                    ? `Masuk ke ${oauthClientInfo.name}`
                    : 'Masuk ke AuthHub'
                }}
              </span>
            </button>

            <!-- Quick fill root admin for testing -->
            <div class="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                @click="fillDemoAdmin"
                class="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡</span>
                <span>Isi Akun Root Superadmin (josapratama@minihost.local)</span>
              </button>
            </div>
          </form>

          <!-- ─── SUB-MODE B: YUBIKEY PIN HARDWARE LOGIN ─── -->
          <div v-else-if="loginMode === 'yubikey'" class="space-y-4">
            <div v-if="yubikeyError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
              <span class="text-base shrink-0">⚠️</span>
              <div>
                <p class="font-bold">Gagal Otentikasi YubiKey</p>
                <p class="leading-relaxed">{{ yubikeyError }}</p>
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-violet-950/40 border border-violet-500/30 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xl shrink-0">
                  🔑
                </div>
                <div>
                  <h3 class="text-xs font-bold text-white">FIDO2 Hardware Key + PIN</h3>
                  <p class="text-[11px] text-slate-400">Verifikasi fisik tanpa password berbasis standar WebAuthn</p>
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-slate-300">
                  Email atau Username (Opsional jika Passkey tersimpan)
                </label>
                <input
                  v-model="yubikeyIdentifier"
                  type="text"
                  placeholder="josapratama / kosongkan untuk passkey"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-violet-500"
                />
              </div>

              <button
                type="button"
                @click="handleYubiKeyLogin"
                :disabled="yubikeyLoading"
                class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span v-if="yubikeyLoading" class="animate-spin text-base">⏳</span>
                <span v-else class="text-base">🔐</span>
                <span>{{ yubikeyLoading ? 'Menunggu PIN & Sentuhan YubiKey...' : 'Mulai Verifikasi YubiKey (PIN)' }}</span>
              </button>
            </div>

            <p class="text-[11px] text-slate-400 text-center leading-relaxed">
              Colokkan atau tempelkan <strong>YubiKey NFC</strong> Anda, masukkan <strong>User PIN</strong>, lalu sentuh sensor emas saat berkedip.
            </p>
          </div>
        </div>

        <!-- ═══════════════════════════════════════════════════════════ -->
        <!-- TAB 2: PUBLIC SELF-REGISTRATION                            -->
        <!-- ═══════════════════════════════════════════════════════════ -->
        <div v-else-if="authTab === 'register'" class="space-y-4">
          <div v-if="regError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
            <span class="text-base shrink-0">⚠️</span>
            <p class="leading-relaxed font-semibold">{{ regError }}</p>
          </div>

          <div v-if="regSuccessMessage" class="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
            <span class="text-base shrink-0">✅</span>
            <p class="leading-relaxed font-semibold">{{ regSuccessMessage }}</p>
          </div>

          <form @submit.prevent="handleRegister" class="space-y-3.5">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-300">Nama Lengkap</label>
              <input
                v-model="regForm.name"
                type="text"
                required
                placeholder="Contoh: Pratama Dev"
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-300">Email</label>
                <input
                  v-model="regForm.email"
                  type="email"
                  required
                  placeholder="dev@example.com"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-300">Username SSO</label>
                <input
                  v-model="regForm.username"
                  type="text"
                  required
                  placeholder="hanya_huruf_angka"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-300">Password</label>
                <input
                  v-model="regForm.password"
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-300">Konfirmasi Password</label>
                <input
                  v-model="regForm.confirmPassword"
                  type="password"
                  required
                  placeholder="Ulangi password"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              :disabled="regLoading"
              class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span v-if="regLoading" class="animate-spin text-base">⏳</span>
              <span v-else>✨</span>
              <span>{{ regLoading ? 'Mendaftarkan Akun...' : 'Daftar Sekarang' }}</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  </div>
</template>
