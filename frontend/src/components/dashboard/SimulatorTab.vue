<script setup lang="ts">
import { ref, computed } from "vue";
import type { OAuthClient, AuthUser } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  clients: OAuthClient[];
  users: AuthUser[];
}>();

const { apiFetch } = useAuth();
const { showToast } = useToast();

const selectedClientSlug = ref(props.clients[0]?.slug || "guidepath");
const selectedUserEmail = ref(props.users[0]?.email || "josapratama@minihost.local");
const simLoading = ref(false);
const simResult = ref<any>(null);

const activeClient = computed(() => {
  return props.clients.find((c) => c.slug === selectedClientSlug.value) || props.clients[0];
});

const activeUser = computed(() => {
  return props.users.find((u) => u.email === selectedUserEmail.value) || props.users[0];
});

async function runSimulation() {
  simLoading.value = true;
  simResult.value = null;

  try {
    const res = await apiFetch("/api/simulate-sso", {
      method: "POST",
      body: JSON.stringify({
        clientSlug: selectedClientSlug.value,
        userIdentifier: selectedUserEmail.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Simulasi gagal dijalankan");
      return;
    }

    simResult.value = data;
    showToast("✅ Simulasi Handshake SSO berhasil diselesaikan!");
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  } finally {
    simLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="space-y-1">
      <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
        <span>⚡ Simulator OAuth2 & SSO Handshake</span>
      </h2>
      <p class="text-xs sm:text-sm text-slate-400">
        Simulasikan bagaimana alur otorisasi OIDC/OAuth2 berjalan dari aplikasi ekosistem hingga mendapatkan token JWT.
      </p>
    </div>

    <!-- Simulator Controller Form -->
    <div class="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Client Selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span>Aplikasi Klien (Target SSO)</span>
          </label>
          <select
            v-model="selectedClientSlug"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option v-for="c in clients" :key="c.id" :value="c.slug">
              {{ c.icon }} {{ c.name }} ({{ c.slug }})
            </option>
          </select>
        </div>

        <!-- User Selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <span>Akun Pengguna yang Masuk</span>
          </label>
          <select
            v-model="selectedUserEmail"
            class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option v-for="u in users" :key="u.id" :value="u.email">
              👤 {{ u.name }} ({{ u.email }}) • Role: {{ u.globalRole }}
            </option>
          </select>
        </div>
      </div>

      <div class="pt-2 flex items-center justify-between">
        <div class="text-[11px] text-slate-400 font-mono">
          Protocol: Authorization Code Grant (PKCE / Confidential Client)
        </div>
        <button
          @click="runSimulation"
          :disabled="simLoading"
          class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <span v-if="simLoading" class="animate-spin text-base">⏳</span>
          <span v-else>⚡</span>
          <span>{{ simLoading ? 'Memproses Handshake...' : 'Jalankan Simulasi Handshake' }}</span>
        </button>
      </div>
    </div>

    <!-- Handshake Steps Display -->
    <div v-if="simResult && simResult.steps" class="space-y-4">
      <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
        <span>🔄 Tahapan Eksekusi Handshake</span>
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="step in simResult.steps"
          :key="step.step"
          class="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-indigo-400">{{ step.title }}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300">{{ step.protocol }}</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">{{ step.description }}</p>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800/80 overflow-x-auto max-h-48 text-[11px] font-mono text-emerald-400">
            <pre>{{ JSON.stringify(step.payload, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Signed JWT Token Card -->
      <div v-if="simResult.accessToken" class="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-indigo-300">Signed JWT Bearer Access Token</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">HMAC-SHA256 Valid</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-200 break-all select-all">
          {{ simResult.accessToken }}
        </div>
      </div>
    </div>
  </div>
</template>
