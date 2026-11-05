<script setup lang="ts">
import { ref, watch } from "vue";
import type { AuthHubSettings, OAuthClient } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  settings: AuthHubSettings;
  clients: OAuthClient[];
}>();

const emit = defineEmits(["refresh-data"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const localSettings = ref<AuthHubSettings>({ ...props.settings });
const saving = ref(false);

watch(
  () => props.settings,
  (val) => {
    if (val) localSettings.value = { ...val };
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
      showToast("✅ Pengaturan sistem berhasil disimpan!");
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
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="space-y-1">
      <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <span>⚙️ Kebijakan Sistem & Pendaftaran Publik</span>
      </h2>
      <p class="text-xs sm:text-sm text-slate-400">
        Konfigurasi apakah user umum dapat mendaftar mandiri dan aplikasi mana saja yang otomatis dapat diakses.
      </p>
    </div>

    <div class="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
      <!-- Toggle 1: Allow Public Registration -->
      <div class="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
        <div class="space-y-1">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>Izinkan Pendaftaran Publik (Self-Registration)</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/10 text-indigo-400 font-mono">Buka / Tutup</span>
          </h3>
          <p class="text-xs text-slate-400 leading-relaxed max-w-lg">
            Jika diaktifkan, tombol <em>"Daftar Akun Baru"</em> akan aktif di halaman login SSO sehingga mahasiswa, dosen, atau tim dapat membuat akun secara mandiri.
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
      <div class="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
        <div class="space-y-1">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>Wajibkan Persetujuan Admin (Moderasi Akun)</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 font-mono">Keamanan</span>
          </h3>
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
          <h3 class="text-sm font-bold text-white">Aplikasi yang Terbuka untuk Member Baru</h3>
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

      <!-- Save Button -->
      <div class="pt-4 flex justify-end">
        <button
          type="button"
          @click="saveSettings"
          :disabled="saving"
          class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan Perubahan Kebijakan' }}
        </button>
      </div>
    </div>
  </div>
</template>
