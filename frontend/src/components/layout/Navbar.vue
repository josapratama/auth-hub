<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../../composables/useAuth.js";

const { isLoggedIn, currentAdmin, activeTab, logout } = useAuth();
const mobileMenuOpen = ref(false);

const navTabs = [
  { id: "overview", label: "Ringkasan", icon: "📊" },
  { id: "simulator", label: "Simulasi SSO", icon: "⚡" },
  { id: "clients", label: "Aplikasi Klien", icon: "🚀" },
  { id: "users", label: "Pengguna & Role", icon: "👥" },
  { id: "sessions", label: "Sesi Aktif", icon: "🌐" },
  { id: "audit", label: "Audit Logs", icon: "📜" },
  { id: "settings", label: "Pengaturan", icon: "⚙️" },
];

function selectTab(id: string) {
  activeTab.value = id;
  mobileMenuOpen.value = false;
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-lg shadow-black/20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16 sm:h-18">
        <!-- Brand Logo & Title -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center shrink-0">
            <span class="text-xl">🛡️</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                AuthHub
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hidden sm:inline-block">
                SSO & RBAC
              </span>
            </div>
            <p class="text-[11px] text-slate-400 hidden sm:block truncate max-w-xs">
              Pusat Identitas Terpadu Seluruh Proyek
            </p>
          </div>
        </div>

        <!-- Desktop Navigation Tabs (when logged in) -->
        <nav v-if="isLoggedIn" class="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-slate-800">
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            @click="selectTab(tab.id)"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            :class="
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            "
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <!-- Right Side: User Profile / Logout / Mobile Trigger -->
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Hardware Token Status Indicator -->
          <div class="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-medium text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FIDO2 • YubiKey Ready</span>
          </div>

          <!-- Logged In Admin Profile -->
          <div v-if="isLoggedIn && currentAdmin" class="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div class="hidden md:block text-right">
              <div class="text-xs font-bold text-white truncate max-w-[120px]">
                {{ currentAdmin.name }}
              </div>
              <div class="text-[10px] text-indigo-400 uppercase font-mono">
                {{ currentAdmin.globalRole }}
              </div>
            </div>
            <button
              @click="logout"
              title="Keluar dari Dashboard"
              class="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/30 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>🚪</span>
              <span class="hidden sm:inline">Keluar</span>
            </button>
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button
            v-if="isLoggedIn"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="lg:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <span v-if="!mobileMenuOpen" class="text-lg">☰</span>
            <span v-else class="text-lg">✕</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Drawer Navigation -->
    <div
      v-if="isLoggedIn && mobileMenuOpen"
      class="lg:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-2 shadow-2xl"
    >
      <div class="text-[11px] uppercase tracking-wider text-slate-500 font-bold px-2 pb-1">
        Menu Navigasi
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          @click="selectTab(tab.id)"
          class="p-3 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer"
          :class="
            activeTab === tab.id
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          "
        >
          <span class="text-base">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
