<script setup lang="ts">
import { computed } from "vue";
import type { OverviewStats, OAuthClient, AuthUser, AuthSession } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";

const props = defineProps<{
  stats: OverviewStats;
  clients: OAuthClient[];
  users: AuthUser[];
  sessions: AuthSession[];
}>();

const emit = defineEmits(["navigate-tab", "add-client"]);
const { currentAdmin } = useAuth();

const activeSessionsCount = computed(() => {
  const now = new Date().toISOString();
  return props.sessions.filter((s) => !s.revoked && s.expiresAt > now).length;
});
</script>

<template>
  <div class="space-y-6">
    <!-- Welcome Header Banner -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/70 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
      <div class="relative z-10 max-w-2xl space-y-2">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[11px] font-bold text-indigo-300">
          <span>🛡️ Single Sign-On Identity Engine</span>
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Pusat Kontrol Identitas & Otorisasi
        </h2>
        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Satu pintu masuk aman berbasis OAuth2, Signed JWT, RBAC multi-proyek, dan perlindungan perangkat keras FIDO2 YubiKey dengan verifikasi PIN.
        </p>
        <div class="pt-2 flex flex-wrap gap-2.5">
          <button
            @click="emit('navigate-tab', 'simulator')"
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚡ Uji Simulasi SSO</span>
          </button>
          <button
            @click="emit('add-client')"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕ Daftarkan Aplikasi Baru</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Stat Metric Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>Aplikasi Terhubung</span>
          <span class="text-base">🚀</span>
        </div>
        <div class="text-2xl sm:text-3xl font-extrabold text-white">
          {{ stats.totalClients || clients.length }}
        </div>
        <p class="text-[11px] text-indigo-400 font-medium">Mini VPS, GuidePath, & 8 lainnya</p>
      </div>

      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>Total Pengguna</span>
          <span class="text-base">👥</span>
        </div>
        <div class="text-2xl sm:text-3xl font-extrabold text-white">
          {{ stats.totalUsers || users.length }}
        </div>
        <p class="text-[11px] text-emerald-400 font-medium">Superadmin, Dosen & Mahasiswa</p>
      </div>

      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>Sesi Aktif</span>
          <span class="text-base">🌐</span>
        </div>
        <div class="text-2xl sm:text-3xl font-extrabold text-white">
          {{ activeSessionsCount }}
        </div>
        <p class="text-[11px] text-amber-400 font-medium">Bisa di-revoke terpusat</p>
      </div>

      <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>Audit Keamanan</span>
          <span class="text-base">📜</span>
        </div>
        <div class="text-2xl sm:text-3xl font-extrabold text-white">
          {{ stats.totalAuditEvents }}
        </div>
        <p class="text-[11px] text-slate-400 font-medium">Tercatat di security log</p>
      </div>
    </div>

    <!-- Connected Applications Grid -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🏢 Ekosistem Aplikasi Terintegrasi</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">{{ clients.length }} Client</span>
        </h3>
        <button
          @click="emit('navigate-tab', 'clients')"
          class="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors cursor-pointer"
        >
          Lihat Semua →
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="c in clients.slice(0, 6)"
          :key="c.id"
          class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md group"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                {{ c.icon }}
              </div>
              <div class="min-w-0">
                <h4 class="text-sm font-bold text-white truncate">{{ c.name }}</h4>
                <span class="text-[10px] font-mono text-slate-400 truncate">{{ c.slug }}</span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Aktif
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
            {{ c.description }}
          </p>
          <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>{{ c.techStack }}</span>
            <span class="text-indigo-400 group-hover:underline cursor-pointer" @click="emit('navigate-tab', 'simulator')">Uji SSO →</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
