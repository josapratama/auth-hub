<script setup lang="ts">
import { ref, watch } from "vue";
import type { AuthHubSettings, OAuthClient, EmailNotificationSettings } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  settings: AuthHubSettings;
  clients: OAuthClient[];
}>();

const emit = defineEmits(["refresh-data"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const defaultEmailConfig: EmailNotificationSettings = {
  enabled: true,
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  fromAddress: "auth@josapratama.com",
  fromName: "AuthHub Security & SSO",
  notifyPasswordReset: true,
  notifyNewUserRegistration: true,
  notifyNewDeviceLogin: true,
  notifySessionRevoked: true,
};

const localSettings = ref<AuthHubSettings>({
  ...props.settings,
  emailNotifications: props.settings.emailNotifications || { ...defaultEmailConfig },
});

const saving = ref(false);
const testingEmail = ref(false);

watch(
  () => props.settings,
  (val) => {
    if (val) {
      localSettings.value = {
        ...val,
        emailNotifications: val.emailNotifications || { ...defaultEmailConfig },
      };
    }
  },
  { deep: true }
);

function toggleClientPublic(slug: string) {
  const current = localSettings.value.publicClientSlugs || [];
  if (current.includes(slug)) {
    localSettings.value.publicClientSlugs = current.filter((s) => s !== slug);
  } else {
    localSettings.value.publicClientSlugs = [...current, slug];
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const res = await apiFetch("/api/settings", {
      method: "POST",
      body: JSON.stringify(localSettings.value),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("✅ Pengaturan sistem & email berhasil disimpan!");
      emit("refresh-data");
    } else {
      showToast(data.error || "Gagal menyimpan pengaturan");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  } finally {
    saving.value = false;
  }
}

async function testEmail() {
  testingEmail.value = true;
  try {
    const res = await apiFetch("/api/settings/test-email", { method: "POST" });
    const data = await res.json();
    if (data.sent) {
      showToast("✅ Email uji coba berhasil dikirim! Periksa kotak masuk Anda.");
    } else {
      showToast(`⚠️ Pengiriman email: ${data.reason}`);
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  } finally {
    testingEmail.value = false;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="space-y-1">
      <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <span>⚙️ Kebijakan Sistem, Registrasi & Notifikasi Email</span>
      </h2>
      <p class="text-xs sm:text-sm text-slate-400">
        Konfigurasi pendaftaran mandiri, persetujuan admin, serta pengaturan server SMTP notifikasi email dan password.
      </p>
    </div>

    <!-- CARD 1: POLICIES & REGISTRATION -->
    <div class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
        1. Kebijakan Pendaftaran Pengguna
      </h3>

      <!-- Toggle 1: Allow Public Registration -->
      <div class="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div class="space-y-1">
          <h4 class="text-sm font-bold text-white flex items-center gap-2">
            <span>Izinkan Pendaftaran Publik (Self-Registration)</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 font-mono">Buka / Tutup</span>
          </h4>
          <p class="text-xs text-slate-400 leading-relaxed max-w-lg">
            Jika diaktifkan, tombol <em>"Daftar Akun Baru"</em> akan aktif di portal login sehingga dosen atau mahasiswa dapat membuat akun secara mandiri.
          </p>
        </div>
        <button
          type="button"
          @click="localSettings.allowPublicRegistration = !localSettings.allowPublicRegistration"
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          :class="localSettings.allowPublicRegistration ? 'bg-indigo-600' : 'bg-slate-700'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="localSettings.allowPublicRegistration ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Toggle 2: Require Admin Approval -->
      <div class="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div class="space-y-1">
          <h4 class="text-sm font-bold text-white flex items-center gap-2">
            <span>Wajibkan Persetujuan Admin (Moderasi Akun)</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 font-mono">Keamanan</span>
          </h4>
          <p class="text-xs text-slate-400 leading-relaxed max-w-lg">
            Jika diaktifkan, akun baru akan berstatus <em>Nonaktif / Pending</em> sampai Administrator menyetujuinya di tab Pengguna.
          </p>
        </div>
        <button
          type="button"
          @click="localSettings.requireAdminApproval = !localSettings.requireAdminApproval"
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          :class="localSettings.requireAdminApproval ? 'bg-indigo-600' : 'bg-slate-700'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="localSettings.requireAdminApproval ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Public Applications Checklist -->
      <div class="space-y-3">
        <div>
          <h4 class="text-sm font-bold text-white">Aplikasi yang Terbuka untuk Member Baru</h4>
          <p class="text-xs text-slate-400">Pilih aplikasi yang otomatis memberikan hak akses (Viewer) kepada akun baru yang terdaftar.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          <div
            v-for="c in clients"
            :key="c.slug"
            @click="toggleClientPublic(c.slug)"
            class="p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all"
            :class="
              localSettings.publicClientSlugs?.includes(c.slug)
                ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            "
          >
            <div class="flex items-center gap-2 truncate">
              <span>{{ c.icon }}</span>
              <span class="text-xs font-semibold truncate">{{ c.name }}</span>
            </div>
            <span v-if="localSettings.publicClientSlugs?.includes(c.slug)" class="text-xs text-indigo-400 font-bold">✓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- CARD 2: EMAIL NOTIFICATIONS & SMTP SETTINGS -->
    <div v-if="localSettings.emailNotifications" class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
          2. Server Notifikasi Email (SMTP) & Password Alert
        </h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-400">Aktifkan Semua:</span>
          <button
            type="button"
            @click="localSettings.emailNotifications.enabled = !localSettings.emailNotifications.enabled"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
            :class="localSettings.emailNotifications.enabled ? 'bg-emerald-600' : 'bg-slate-700'"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="localSettings.emailNotifications.enabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </div>

      <!-- Granular Category Toggles -->
      <div class="space-y-3">
        <div class="text-xs font-bold text-slate-300">Pilih Notifikasi yang Ingin Diaktifkan / Dinonaktifkan:</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <!-- Item 1: Reset Password -->
          <label class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span class="text-slate-200">🔐 OTP & Reset Password</span>
            <input
              v-model="localSettings.emailNotifications.notifyPasswordReset"
              type="checkbox"
              class="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
          </label>

          <!-- Item 2: User Registration -->
          <label class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span class="text-slate-200">✨ Pendaftaran Akun Baru</span>
            <input
              v-model="localSettings.emailNotifications.notifyNewUserRegistration"
              type="checkbox"
              class="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
          </label>

          <!-- Item 3: New Device Login -->
          <label class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span class="text-slate-200">📱 Deteksi Login Perangkat Baru</span>
            <input
              v-model="localSettings.emailNotifications.notifyNewDeviceLogin"
              type="checkbox"
              class="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
          </label>

          <!-- Item 4: Session Revoked -->
          <label class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
            <span class="text-slate-200">⚠️ Sesi Di-Revoke / Killswitch</span>
            <input
              v-model="localSettings.emailNotifications.notifySessionRevoked"
              type="checkbox"
              class="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      <!-- SMTP Credentials Form -->
      <div class="space-y-3 pt-2 border-t border-slate-800/80 text-xs">
        <div class="text-xs font-bold text-slate-300">Konfigurasi Host SMTP:</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-1 sm:col-span-2">
            <label class="font-semibold text-slate-400">SMTP Host</label>
            <input
              v-model="localSettings.emailNotifications.smtpHost"
              type="text"
              placeholder="smtp.gmail.com"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
          <div class="space-y-1">
            <label class="font-semibold text-slate-400">SMTP Port</label>
            <input
              v-model.number="localSettings.emailNotifications.smtpPort"
              type="number"
              placeholder="587"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="font-semibold text-slate-400">Username SMTP / Email Pengirim</label>
            <input
              v-model="localSettings.emailNotifications.smtpUser"
              type="text"
              placeholder="admin@domain.com"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
          <div class="space-y-1">
            <label class="font-semibold text-slate-400">Password / App Password</label>
            <input
              v-model="localSettings.emailNotifications.smtpPass"
              type="password"
              placeholder="••••••••••••"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="font-semibold text-slate-400">Nama Pengirim (From Name)</label>
            <input
              v-model="localSettings.emailNotifications.fromName"
              type="text"
              placeholder="AuthHub Security & SSO"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>
          <div class="space-y-1">
            <label class="font-semibold text-slate-400">Alamat Pengirim (From Address)</label>
            <input
              v-model="localSettings.emailNotifications.fromAddress"
              type="email"
              placeholder="auth@josapratama.com"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
        <button
          type="button"
          @click="testEmail"
          :disabled="testingEmail"
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <span v-if="testingEmail" class="animate-spin">⏳</span>
          <span v-else>📧</span>
          <span>{{ testingEmail ? 'Mengirim Test...' : 'Kirim Email Uji Coba' }}</span>
        </button>

        <button
          type="button"
          @click="saveSettings"
          :disabled="saving"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan' }}
        </button>
      </div>
    </div>
  </div>
</template>
