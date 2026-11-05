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
  <header class="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-b border-slate-800/80 shadow-xl shadow-black/30">
    <!-- ─── TIER 1: BRAND LOGO, SYSTEM STATUS & USER CONTROLS ─── -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Left: Brand Logo & Title -->
        <div class="flex items-center gap-3 shrink-0">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-400 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center shrink-0">
            <span class="text-xl">🛡️</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                AuthHub
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                SSO & RBAC
              </span>
            </div>
            <p class="text-[11px] text-slate-400 hidden sm:block truncate">
              Pusat Identitas Terpadu Seluruh Proyek
            </p>
          </div>
        </div>

        <!-- Right Side: Hardware Token Indicator, User Profile & Logout -->
        <div class="flex items-center gap-2 sm:gap-4 shrink-0">
          <!-- FIDO2 YubiKey Status Badge -->
          <div class="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FIDO2 • YubiKey Ready</span>
          </div>

          <!-- Logged In Admin Profile & Logout -->
          <div v-if="isLoggedIn && currentAdmin" class="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-800">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-xs shadow-md">
                {{ currentAdmin.name.charAt(0).toUpperCase() }}
              </div>
              <div class="hidden sm:block text-left">
                <div class="text-xs font-bold text-white truncate max-w-[130px]">
                  {{ currentAdmin.name }}
                </div>
                <div class="text-[10px] text-indigo-400 uppercase font-mono font-bold leading-none">
                  {{ currentAdmin.globalRole }}
                </div>
              </div>
            </div>

            <!-- Logout Button -->
            <button
              @click="logout"
              title="Keluar dari Dashboard"
              class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span class="text-sm">🚪</span>
              <span class="hidden sm:inline">Keluar</span>
            </button>
          </div>

          <!-- Mobile Hamburger Toggle -->
          <button
            v-if="isLoggedIn"
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            <span v-if="!mobileMenuOpen" class="text-lg">☰</span>
            <span v-else class="text-lg">✕</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ─── TIER 2: SECONDARY NAVIGATION TAB STRIP (DESKTOP) ─── -->
    <div v-if="isLoggedIn" class="hidden md:block border-t border-slate-800/80 bg-slate-950/60">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav class="flex items-center gap-1 py-1.5 overflow-x-auto no-scrollbar">
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            @click="selectTab(tab.id)"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            :class="
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
            "
          >
            <span class="text-sm">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>
    </div>

    <!-- ─── MOBILE DRAWER MENU (PHONE SCREENS) ─── -->
    <div
      v-if="isLoggedIn && mobileMenuOpen"
      class="md:hidden border-t border-slate-800 bg-slate-950/98 backdrop-blur-2xl px-4 py-4 space-y-3 shadow-2xl"
    >
      <div class="flex items-center justify-between px-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-900">
        <span>Menu Navigasi SSO</span>
        <span class="text-emerald-400 font-mono">FIDO2 Ready</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          @click="selectTab(tab.id)"
          class="p-3 rounded-xl text-left text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap"
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

<style scoped>
/* Hide horizontal scrollbar for clean tab scrolling */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
