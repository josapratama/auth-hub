<script setup lang="ts">
import { computed } from "vue";
import type { AuthSession, OAuthClient } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  sessions: AuthSession[];
  clients: OAuthClient[];
}>();

const emit = defineEmits(["refresh-data"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const activeSessions = computed(() => {
  const now = new Date().toISOString();
  return props.sessions.filter((s) => !s.revoked && s.expiresAt > now);
});

async function revokeSingle(sessionId: string) {
  try {
    const res = await apiFetch("/api/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      showToast("Sesi berhasil di-revoke!");
      emit("refresh-data");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal mencabut sesi");
  }
}

async function killswitchApp(clientSlug: string) {
  if (!confirm(`Putuskan seluruh sesi aktif untuk aplikasi '${clientSlug}'?`)) return;
  try {
    const res = await apiFetch("/api/sessions/killswitch-app", {
      method: "POST",
      body: JSON.stringify({ clientSlug }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || "Sesi aplikasi berhasil diputuskan!");
      emit("refresh-data");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menjalankan kill-switch");
  }
}

async function emergencyKillswitchAll() {
  if (!confirm("🚨 PERINGATAN: Anda akan memutuskan SELURUH sesi aktif di semua aplikasi ekosistem! Lanjutkan?")) return;
  try {
    const res = await apiFetch("/api/sessions/killswitch-all", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || "Seluruh sesi berhasil diputus!");
      emit("refresh-data");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menjalankan emergency kill-switch");
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>🌐 Sesi Aktif & Global Kill-Switch</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-400">
          Monitor sesi login yang sedang berlangsung dan putuskan akses kapan saja secara instan.
        </p>
      </div>

      <button
        @click="emergencyKillswitchAll"
        class="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
      >
        <span>🚨 Emergency Kill-Switch (Semua Sesi)</span>
      </button>
    </div>

    <!-- Sessions List (Responsive) -->
    <div class="space-y-3">
      <div v-if="activeSessions.length === 0" class="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
        <span class="text-3xl">🛡️</span>
        <h3 class="text-sm font-bold text-white">Tidak Ada Sesi Aktif Saat Ini</h3>
        <p class="text-xs text-slate-400">Belum ada user yang login melalui OAuth SSO atau dashboard.</p>
      </div>

      <div
        v-for="s in activeSessions"
        :key="s.id"
        class="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start sm:items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-lg shrink-0">
            💻
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-bold text-white">{{ s.userName }}</span>
              <span class="text-xs text-slate-400 font-mono">({{ s.userEmail }})</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                {{ s.clientName }}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-500/15 text-violet-300">
                {{ s.appRole }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1 flex-wrap">
              <span>IP: {{ s.ipAddress }}</span>
              <span>•</span>
              <span class="truncate max-w-[220px]">{{ s.userAgent }}</span>
              <span>•</span>
              <span>Kadaluwarsa: {{ new Date(s.expiresAt).toLocaleTimeString('id-ID') }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            @click="killswitchApp(s.clientSlug)"
            class="px-3 py-1.5 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs font-semibold cursor-pointer"
            title="Putus seluruh sesi di aplikasi ini"
          >
            Kill App
          </button>
          <button
            @click="revokeSingle(s.id)"
            class="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Revoke Sesi
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
