<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";
import type { OAuthClient, AuthSession, WebAuthnKeyInfo } from "../../types/index.js";

const emit = defineEmits(["register-yubikey"]);
const { currentAdmin, apiFetch } = useAuth();
const { showToast } = useToast();

const activeSubTab = ref<"apps" | "security" | "sessions">("apps");
const searchAppQuery = ref("");

// Member Portal Data
const loading = ref(true);
const memberUser = ref<any>(null);
const apps = ref<OAuthClient[]>([]);
const sessions = ref<AuthSession[]>([]);
const yubikeys = ref<WebAuthnKeyInfo[]>([]);

// Password change state
const pwdForm = ref({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const pwdLoading = ref(false);
const pwdError = ref("");
const pwdSuccess = ref("");

async function loadPortalData() {
  loading.value = true;
  try {
    const res = await apiFetch("/api/me/portal");
    if (!res.ok) {
      showToast("Gagal memuat data portal pengguna.", "error");
      return;
    }
    const data = await res.json();
    memberUser.value = data.user;
    apps.value = data.apps || [];
    sessions.value = data.sessions || [];
    yubikeys.value = data.user?.keys || [];
  } catch (err: any) {
    showToast(err.message || "Kesalahan jaringan.", "error");
  } finally {
    loading.value = false;
  }
}

const filteredApps = computed(() => {
  if (!searchAppQuery.value.trim()) return apps.value;
  const q = searchAppQuery.value.toLowerCase();
  return apps.value.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      a.techStack.toLowerCase().includes(q)
  );
});

async function handleChangePassword() {
  pwdError.value = "";
  pwdSuccess.value = "";

  if (!pwdForm.value.currentPassword) {
    pwdError.value = "Masukkan password saat ini.";
    return;
  }
  if (!pwdForm.value.newPassword || pwdForm.value.newPassword.length < 6) {
    pwdError.value = "Password baru minimal 6 karakter.";
    return;
  }
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    pwdError.value = "Konfirmasi password baru tidak cocok.";
    return;
  }

  pwdLoading.value = true;
  try {
    const res = await apiFetch("/api/me/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: pwdForm.value.currentPassword,
        newPassword: pwdForm.value.newPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      pwdError.value = data.error || "Gagal memperbarui password.";
      return;
    }
    pwdSuccess.value = data.message || "Password berhasil diperbarui!";
    showToast("✅ Password Anda berhasil diperbarui!");
    pwdForm.value.currentPassword = "";
    pwdForm.value.newPassword = "";
    pwdForm.value.confirmPassword = "";
  } catch (err: any) {
    pwdError.value = err.message || "Gagal menghubungi server.";
  } finally {
    pwdLoading.value = false;
  }
}

async function handleDeleteKey(keyId: string, keyName?: string) {
  if (!confirm(`Hapus kunci fisik "${keyName || 'YubiKey'}" dari akun Anda?`)) return;

  try {
    const res = await apiFetch(`/api/webauthn/keys/${keyId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal menghapus kunci", "error");
      return;
    }
    showToast(data.message || "Kunci fisik berhasil dihapus.");
    await loadPortalData();
  } catch (err: any) {
    showToast(err.message || "Terjadi kesalahan.", "error");
  }
}

async function handleRevokeSession(sid: string) {
  if (!confirm("Putuskan sesi perangkat ini?")) return;

  try {
    const res = await apiFetch(`/api/me/sessions/${sid}/revoke`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal mencabut sesi", "error");
      return;
    }
    showToast("Sesi berhasil diputus.");
    await loadPortalData();
  } catch (err: any) {
    showToast(err.message || "Terjadi kesalahan.", "error");
  }
}

function launchApp(app: OAuthClient) {
  const url = app.homepageUrl || `https://${app.slug}.josapratama.com`;
  window.open(url, "_blank");
}

onMounted(() => {
  loadPortalData();
});

defineExpose({
  refresh: loadPortalData,
});
</script>

<template>
  <div class="space-y-6">
    <!-- ─── MEMBER WELCOME BANNER ─── -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-indigo-950/40 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
      <div class="absolute -right-16 -top-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -left-16 -bottom-16 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4 sm:gap-5">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 p-0.5 shadow-xl shadow-indigo-600/20 shrink-0 flex items-center justify-center">
            <div class="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-2xl sm:text-3xl text-indigo-400">
              {{ currentAdmin?.name ? currentAdmin.name.charAt(0).toUpperCase() : 'M' }}
            </div>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <h1 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Halo, {{ currentAdmin?.name || 'Member' }}
              </h1>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Member SSO
              </span>
            </div>
            <p class="text-xs sm:text-sm text-slate-400 font-mono">
              {{ currentAdmin?.email }} • <span class="text-indigo-400">@{{ currentAdmin?.username }}</span>
            </p>
          </div>
        </div>

        <!-- Quick Status Metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 shrink-0">
          <div class="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3">
            <div class="text-[11px] text-slate-400 uppercase font-semibold">Aplikasi</div>
            <div class="text-lg font-bold text-white">{{ apps.length }} Tersedia</div>
          </div>
          <div class="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3">
            <div class="text-[11px] text-slate-400 uppercase font-semibold">Hardware Key</div>
            <div class="text-lg font-bold" :class="yubikeys.length > 0 ? 'text-emerald-400' : 'text-amber-400'">
              {{ yubikeys.length > 0 ? `${yubikeys.length} Terdaftar` : 'Belum Ada' }}
            </div>
          </div>
          <div class="col-span-2 sm:col-span-1 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3">
            <div class="text-[11px] text-slate-400 uppercase font-semibold">Sesi Aktif</div>
            <div class="text-lg font-bold text-indigo-400">{{ sessions.length }} Perangkat</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── NAVIGATION SUB-TABS ─── -->
    <div class="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto no-scrollbar">
      <button
        @click="activeSubTab = 'apps'"
        :class="activeSubTab === 'apps' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'"
        class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
      >
        <span>🚀</span>
        <span>Aplikasi Saya (App Launcher)</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40">{{ apps.length }}</span>
      </button>

      <button
        @click="activeSubTab = 'security'"
        :class="activeSubTab === 'security' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'"
        class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
      >
        <span>🔐</span>
        <span>Keamanan & YubiKey</span>
        <span v-if="yubikeys.length > 0" class="w-2 h-2 rounded-full bg-emerald-400"></span>
      </button>

      <button
        @click="activeSubTab = 'sessions'"
        :class="activeSubTab === 'sessions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900/70 text-slate-400 hover:text-white hover:bg-slate-800'"
        class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
      >
        <span>🌐</span>
        <span>Sesi Login Aktif</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/40">{{ sessions.length }}</span>
      </button>
    </div>

    <!-- ─── SUB-TAB 1: APP LAUNCHER (APLIKASI SAYA) ─── -->
    <div v-if="activeSubTab === 'apps'" class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🚀</span> Katalog Aplikasi Terhubung
          </h2>
          <p class="text-xs text-slate-400">
            Akses langsung seluruh ekosistem aplikasi hanya dengan sekali klik (Single Sign-On).
          </p>
        </div>

        <div class="relative w-full sm:w-64">
          <input
            v-model="searchAppQuery"
            type="text"
            placeholder="Cari aplikasi..."
            class="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="app in filteredApps"
          :key="app.id"
          class="group relative rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-indigo-500/50 p-5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div>
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform">
                {{ app.icon || '🚀' }}
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {{ app.techStack || 'Ecosystem' }}
              </span>
            </div>

            <h3 class="font-extrabold text-white text-base mb-1 group-hover:text-indigo-300 transition-colors">
              {{ app.name }}
            </h3>
            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
              {{ app.description || 'Aplikasi resmi ekosistem terintegrasi SSO AuthHub.' }}
            </p>
          </div>

          <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono text-slate-500 truncate">
              {{ app.slug }}
            </span>
            <button
              @click="launchApp(app)"
              class="px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Buka</span>
              <span>↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── SUB-TAB 2: SECURITY & YUBIKEY MANAGEMENT ─── -->
    <div v-else-if="activeSubTab === 'security'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Section A: Hardware Security Token (YubiKey / FIDO2) -->
      <div class="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 space-y-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <span>🛡️</span> Kunci Fisik YubiKey (FIDO2)
            </h3>
            <p class="text-xs text-slate-400">
              Proteksi tingkat militer tanpa phishing menggunakan PIN & sensor sentuh.
            </p>
          </div>
          <button
            @click="emit('register-yubikey')"
            class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>+</span>
            <span>Daftar Kunci Baru</span>
          </button>
        </div>

        <div v-if="yubikeys.length === 0" class="text-center py-8 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40">
          <span class="text-3xl block mb-2">🔑</span>
          <p class="text-xs text-slate-300 font-semibold mb-1">Belum ada YubiKey terdaftar</p>
          <p class="text-[11px] text-slate-500 max-w-xs mx-auto mb-4">
            Daftarkan kunci fisik FIDO2 Anda sekarang untuk mengaktifkan login super aman tanpa password.
          </p>
          <button
            @click="emit('register-yubikey')"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Mulai Pendaftaran YubiKey
          </button>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="key in yubikeys"
            :key="key.id"
            class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-lg">
                🔐
              </div>
              <div>
                <div class="text-xs font-bold text-white">{{ key.name || 'YubiKey Hardware Token' }}</div>
                <div class="text-[10px] text-slate-500 font-mono">
                  Didaftarkan: {{ new Date(key.createdAt).toLocaleDateString('id-ID') }}
                </div>
              </div>
            </div>

            <button
              @click="handleDeleteKey(key.id, key.name)"
              title="Hapus Kunci Ini"
              class="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-colors cursor-pointer"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>

      <!-- Section B: Change Password -->
      <div class="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 space-y-4">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <span>🔑</span> Ubah Password Akun
          </h3>
          <p class="text-xs text-slate-400">
            Perbarui password masuk SSO Anda secara mandiri sewaktu-waktu.
          </p>
        </div>

        <div v-if="pwdError" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          ⚠️ {{ pwdError }}
        </div>
        <div v-if="pwdSuccess" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          ✅ {{ pwdSuccess }}
        </div>

        <form @submit.prevent="handleChangePassword" class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Password Saat Ini</label>
            <input
              v-model="pwdForm.currentPassword"
              type="password"
              placeholder="••••••••"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Password Baru (Min. 6 Karakter)</label>
            <input
              v-model="pwdForm.newPassword"
              type="password"
              placeholder="••••••••"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Konfirmasi Password Baru</label>
            <input
              v-model="pwdForm.confirmPassword"
              type="password"
              placeholder="••••••••"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            :disabled="pwdLoading"
            class="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span v-if="pwdLoading" class="animate-spin text-sm">⏳</span>
            <span>Simpan Perubahan Password</span>
          </button>
        </form>
      </div>
    </div>

    <!-- ─── SUB-TAB 3: ACTIVE SESSIONS ─── -->
    <div v-else-if="activeSubTab === 'sessions'" class="space-y-4">
      <div>
        <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <span>🌐</span> Sesi Login Perangkat Saya
        </h2>
        <p class="text-xs text-slate-400">
          Daftar browser dan perangkat yang sedang terhubung ke akun Anda. Anda dapat mencabut sesi kapan saja.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="sess in sessions"
          :key="sess.id"
          class="rounded-2xl bg-slate-900/50 border border-slate-800/80 p-4 flex flex-col justify-between"
        >
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {{ sess.clientName || sess.clientSlug }}
              </span>
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>

            <div class="text-xs font-bold text-white">
              {{ sess.deviceInfo?.browser || 'Browser' }} di {{ sess.deviceInfo?.os || 'OS' }}
            </div>
            <div class="text-[11px] text-slate-400 font-mono">
              IP: {{ sess.ipAddress }}
            </div>
            <div class="text-[10px] text-slate-500">
              Masuk: {{ new Date(sess.issuedAt).toLocaleString('id-ID') }}
            </div>
          </div>

          <button
            @click="handleRevokeSession(sess.id)"
            class="w-full py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            Putuskan Sesi Ini
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
