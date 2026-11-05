<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useAuth } from "./composables/useAuth.js";
import { useToast } from "./composables/useToast.js";
import type { OAuthClient, AuthUser, AuthSession, AuditLog, AuthHubSettings, OverviewStats } from "./types/index.js";

// Layout Components
import Navbar from "./components/layout/Navbar.vue";
import Toast from "./components/layout/Toast.vue";

// Portal Component (Public SSO & Registration)
import PublicAuthPortal from "./components/portal/PublicAuthPortal.vue";

// Dashboard Tab Components
import OverviewTab from "./components/dashboard/OverviewTab.vue";
import SimulatorTab from "./components/dashboard/SimulatorTab.vue";
import ClientsTab from "./components/dashboard/ClientsTab.vue";
import UsersTab from "./components/dashboard/UsersTab.vue";
import SessionsTab from "./components/dashboard/SessionsTab.vue";
import AuditLogsTab from "./components/dashboard/AuditLogsTab.vue";
import SettingsTab from "./components/dashboard/SettingsTab.vue";

// Modals
import ClientModal from "./components/modals/ClientModal.vue";
import UserModal from "./components/modals/UserModal.vue";
import YubiKeyRegisterModal from "./components/modals/YubiKeyRegisterModal.vue";

const { isLoggedIn, activeTab, apiFetch } = useAuth();
const { showToast } = useToast();

// State Data
const stats = ref<OverviewStats>({
  totalClients: 0,
  totalUsers: 0,
  activeSessions: 0,
  totalAuditEvents: 0,
});
const clients = ref<OAuthClient[]>([]);
const users = ref<AuthUser[]>([]);
const sessions = ref<AuthSession[]>([]);
const auditLogs = ref<AuditLog[]>([]);
const settings = ref<AuthHubSettings>({
  allowPublicRegistration: true,
  requireAdminApproval: false,
  defaultMemberRole: "member",
  publicClientSlugs: ["guidepath", "nexus-chat", "polyglot-hub", "portfolio", "uploadbox", "uml-flow"],
});

// Modal Open States
const isClientModalOpen = ref(false);
const isUserModalOpen = ref(false);
const isYubiKeyModalOpen = ref(false);

async function loadData() {
  if (!isLoggedIn.value) return;
  try {
    const res = await apiFetch("/api/overview");
    if (!res.ok) return;
    const data = await res.json();
    stats.value = data.stats || stats.value;
    clients.value = data.clients || [];
    users.value = data.users || [];
    sessions.value = data.sessions || [];
    auditLogs.value = data.auditLogs || [];
    settings.value = data.settings || settings.value;
  } catch (err) {
    console.warn("Failed to load overview bundle", err);
  }
}

onMounted(() => {
  loadData();
});

watch(isLoggedIn, (val) => {
  if (val) loadData();
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-white">
    <!-- Navbar Header -->
    <Navbar />

    <!-- Main Container -->
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      
      <!-- VIEW A: PUBLIC AUTH PORTAL (When not logged in or visiting SSO link) -->
      <PublicAuthPortal
        v-if="!isLoggedIn"
        @login-success="loadData"
      />

      <!-- VIEW B: AUTH-HUB MANAGEMENT DASHBOARD (When authenticated) -->
      <div v-else class="space-y-6">
        <!-- Tab 1: Overview -->
        <OverviewTab
          v-if="activeTab === 'overview'"
          :stats="stats"
          :clients="clients"
          :users="users"
          :sessions="sessions"
          @navigate-tab="(t: string) => activeTab = t"
          @add-client="isClientModalOpen = true"
        />

        <!-- Tab 2: SSO Simulator -->
        <SimulatorTab
          v-else-if="activeTab === 'simulator'"
          :clients="clients"
          :users="users"
        />

        <!-- Tab 3: OAuth2 Clients -->
        <ClientsTab
          v-else-if="activeTab === 'clients'"
          :clients="clients"
          @add-client="isClientModalOpen = true"
          @refresh-data="loadData"
        />

        <!-- Tab 4: Users & RBAC Directory -->
        <UsersTab
          v-else-if="activeTab === 'users'"
          :users="users"
          :clients="clients"
          @add-user="isUserModalOpen = true"
          @register-yubikey="isYubiKeyModalOpen = true"
          @refresh-data="loadData"
        />

        <!-- Tab 5: Active Sessions & Kill-Switch -->
        <SessionsTab
          v-else-if="activeTab === 'sessions'"
          :sessions="sessions"
          :clients="clients"
          @refresh-data="loadData"
        />

        <!-- Tab 6: Security Audit Trail -->
        <AuditLogsTab
          v-else-if="activeTab === 'audit'"
          :audit-logs="auditLogs"
        />

        <!-- Tab 7: System Settings & Policies -->
        <SettingsTab
          v-else-if="activeTab === 'settings'"
          :settings="settings"
          :clients="clients"
          @refresh-data="loadData"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>AuthHub v2.0 • Centralized Identity & OAuth2 Engine</span>
        <span>Secured with FIDO2 WebAuthn & PBKDF2-SHA512</span>
      </div>
    </footer>

    <!-- Modals -->
    <ClientModal
      :open="isClientModalOpen"
      @close="isClientModalOpen = false"
      @created="loadData"
    />

    <UserModal
      :open="isUserModalOpen"
      @close="isUserModalOpen = false"
      @created="loadData"
    />

    <YubiKeyRegisterModal
      :open="isYubiKeyModalOpen"
      @close="isYubiKeyModalOpen = false"
      @registered="loadData"
    />

    <!-- Global Toast Alert -->
    <Toast />
  </div>
</template>
