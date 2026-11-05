<script setup lang="ts">
import { ref } from "vue";
import type { OAuthClient } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  clients: OAuthClient[];
}>();

const emit = defineEmits(["add-client", "refresh-data"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const revealedSecrets = ref<Record<string, boolean>>({});

function toggleSecret(id: string) {
  revealedSecrets.value[id] = !revealedSecrets.value[id];
}

async function copyToClipboard(text: string, label = "Kredensial") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`✅ ${label} berhasil disalin ke clipboard!`);
  } catch {
    showToast("Gagal menyalin secara otomatis");
  }
}

async function rotateSecret(id: string) {
  if (!confirm("Apakah Anda yakin ingin me-rotate client_secret ini? Aplikasi klien yang aktif harus memperbarui secret di .env.")) {
    return;
  }
  try {
    const res = await apiFetch(`/api/clients/${id}/rotate-secret`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showToast("✅ Client secret berhasil diperbarui!");
      emit("refresh-data");
    } else {
      showToast(data.error || "Gagal memperbarui secret");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>🚀 Aplikasi Klien Terdaftar (OAuth2 Clients)</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-400">
          Kelola kredensial OAuth2 (client_id, client_secret) dan URI callback yang diizinkan untuk SSO.
        </p>
      </div>
      <button
        @click="emit('add-client')"
        class="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
      >
        <span>➕ Daftarkan Aplikasi Baru</span>
      </button>
    </div>

    <!-- Client Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="c in clients"
        :key="c.id"
        class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
              {{ c.icon }}
            </div>
            <div>
              <h3 class="text-base font-bold text-white">{{ c.name }}</h3>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs font-mono text-indigo-400">{{ c.slug }}</span>
                <span class="text-[10px] text-slate-500 font-mono">• {{ c.techStack }}</span>
              </div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Aktif
          </span>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">{{ c.description }}</p>

        <!-- Credentials Block -->
        <div class="space-y-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
          <!-- Client ID -->
          <div class="flex items-center justify-between gap-2">
            <span class="text-slate-400 font-mono text-[11px]">Client ID:</span>
            <div class="flex items-center gap-1.5 font-mono text-slate-200 truncate">
              <span class="truncate max-w-[200px] sm:max-w-xs">{{ c.clientId }}</span>
              <button
                @click="copyToClipboard(c.clientId, 'Client ID')"
                class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Salin Client ID"
              >
                📋
              </button>
            </div>
          </div>

          <!-- Client Secret -->
          <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <span class="text-slate-400 font-mono text-[11px]">Client Secret:</span>
            <div class="flex items-center gap-1.5 font-mono text-slate-200">
              <span class="truncate max-w-[160px] sm:max-w-[200px]">
                {{ revealedSecrets[c.id] ? c.clientSecret : '••••••••••••••••••••••••••••' }}
              </span>
              <button
                @click="toggleSecret(c.id)"
                class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Tampilkan / Sembunyikan Secret"
              >
                {{ revealedSecrets[c.id] ? '🙈' : '👁️' }}
              </button>
              <button
                @click="copyToClipboard(c.clientSecret, 'Client Secret')"
                class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Salin Client Secret"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        <!-- Redirect URIs & Actions -->
        <div class="pt-2 flex items-center justify-between text-xs">
          <div class="text-[11px] text-slate-400 truncate max-w-[220px]">
            Callback: <span class="font-mono text-slate-300">{{ c.redirectUris[0] }}</span>
          </div>
          <button
            @click="rotateSecret(c.id)"
            class="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            🔄 Rotate Secret
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
