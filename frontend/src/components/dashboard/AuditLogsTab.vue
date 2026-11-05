<script setup lang="ts">
import { ref, computed } from "vue";
import type { AuditLog } from "../../types/index.js";

const props = defineProps<{
  auditLogs: AuditLog[];
}>();

const selectedStatus = ref<string>("all");
const searchQuery = ref("");

const filteredLogs = computed(() => {
  return props.auditLogs.filter((log) => {
    const matchStatus = selectedStatus.value === "all" || log.status === selectedStatus.value;
    const q = searchQuery.value.toLowerCase().trim();
    const matchQuery =
      !q ||
      log.event.toLowerCase().includes(q) ||
      log.userEmail.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.ipAddress.includes(q);
    return matchStatus && matchQuery;
  });
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>📜 Audit Log Keamanan & Aktivitas SSO</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-400">
          Riwayat lengkap setiap aktivitas otorisasi, penukaran token, login YubiKey, dan perubahan kebijakan keamanan.
        </p>
      </div>
    </div>

    <!-- Filter Bar (Search + Status Badges) -->
    <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="st in [
            { id: 'all', label: 'Semua' },
            { id: 'success', label: 'Sukses (OK)' },
            { id: 'warning', label: 'Peringatan' },
            { id: 'danger', label: 'Ditolak / Bahaya' },
            { id: 'info', label: 'Info' },
          ]"
          :key="st.id"
          @click="selectedStatus = st.id"
          class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          :class="
            selectedStatus === st.id
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
          "
        >
          {{ st.label }}
        </button>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="Cari event, email, atau IP..."
        class="w-full sm:w-64 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
      />
    </div>

    <!-- Audit Logs Stream -->
    <div class="space-y-2.5">
      <div v-if="filteredLogs.length === 0" class="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
        Tidak ada catatan audit yang cocok dengan filter.
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span
              class="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider"
              :class="{
                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30': log.status === 'success',
                'bg-rose-500/15 text-rose-400 border border-rose-500/30': log.status === 'danger',
                'bg-amber-500/15 text-amber-400 border border-amber-500/30': log.status === 'warning',
                'bg-slate-700/40 text-slate-300 border border-slate-600/30': log.status === 'info',
              }"
            >
              {{ log.event }}
            </span>
            <span class="text-xs font-bold text-white truncate">{{ log.userEmail }}</span>
            <span v-if="log.clientSlug" class="px-2 py-0.2 rounded text-[10px] bg-indigo-500/10 text-indigo-400 font-mono">
              {{ log.clientSlug }}
            </span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">{{ log.details }}</p>
        </div>

        <div class="text-[11px] font-mono text-slate-500 self-start sm:self-center shrink-0 sm:text-right">
          <div>{{ new Date(log.timestamp).toLocaleTimeString('id-ID') }}</div>
          <div class="text-[10px]">{{ log.ipAddress }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
