<script setup lang="ts">
import { ref } from "vue";
import type { AuthUser, OAuthClient, AppRole } from "../../types/index.js";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  users: AuthUser[];
  clients: OAuthClient[];
}>();

const emit = defineEmits(["add-user", "register-yubikey", "refresh-data"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const selectedUserForPerms = ref<AuthUser | null>(null);
const selectedClientSlug = ref<string>("");

async function toggleActive(userId: string) {
  try {
    const res = await apiFetch(`/api/users/${userId}/toggle-active`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      showToast(`Status pengguna berhasil diubah`);
      emit("refresh-data");
    } else {
      showToast(data.error || "Gagal mengubah status pengguna");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  }
}

async function updateRole(userId: string, clientSlug: string, newRole: AppRole) {
  try {
    const res = await apiFetch(`/api/users/${userId}/role`, {
      method: "POST",
      body: JSON.stringify({ clientSlug, role: newRole }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Role di ${clientSlug} diubah menjadi ${newRole.toUpperCase()}`);
      emit("refresh-data");
    } else {
      showToast(data.error || "Gagal memperbarui role");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal menghubungi server");
  }
}

function openPermsModal(user: AuthUser, clientSlug: string) {
  selectedUserForPerms.value = user;
  selectedClientSlug.value = clientSlug;
}

async function toggleUserPermission(permKey: string) {
  if (!selectedUserForPerms.value || !selectedClientSlug.value) return;

  const user = selectedUserForPerms.value;
  const current = (user.permissions?.[selectedClientSlug.value] || []);
  let updated: string[];

  if (current.includes(permKey)) {
    updated = current.filter((p) => p !== permKey);
  } else {
    updated = [...current, permKey];
  }

  try {
    const res = await apiFetch(`/api/users/${user.id}/permissions`, {
      method: "POST",
      body: JSON.stringify({
        clientSlug: selectedClientSlug.value,
        permissions: updated,
      }),
    });
    if (res.ok) {
      if (!user.permissions) user.permissions = {};
      user.permissions[selectedClientSlug.value] = updated;
      showToast(`Izin '${permKey}' berhasil diperbarui`);
      emit("refresh-data");
    }
  } catch (err: any) {
    showToast(err.message || "Gagal memperbarui izin");
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>👥 Direktori Pengguna & Hak Akses (RBAC + Permissions)</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-400">
          Kelola peran pengguna (Superadmin, Admin, Viewer, None) serta izin granular (Permissions) per aplikasi.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          @click="emit('register-yubikey')"
          class="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md shadow-violet-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>🔑 Daftarkan YubiKey Saya</span>
        </button>
        <button
          @click="emit('add-user')"
          class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>➕ Tambah Pengguna</span>
        </button>
      </div>
    </div>

    <!-- Users Cards List -->
    <div class="space-y-4">
      <div
        v-for="u in users"
        :key="u.id"
        class="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-4"
      >
        <!-- User Header Info -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-base shadow-md">
              {{ u.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm sm:text-base font-bold text-white">{{ u.name }}</h3>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  :class="
                    u.globalRole === 'superadmin'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : u.globalRole === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  "
                >
                  {{ u.globalRole }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="u.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'"
                >
                  {{ u.isActive ? 'Aktif' : 'Nonaktif / Pending' }}
                </span>
              </div>
              <p class="text-xs text-slate-400 font-mono mt-0.5">{{ u.email }} • @{{ u.username }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-start sm:self-auto">
            <button
              v-if="u.id !== 'usr_josa_root'"
              @click="toggleActive(u.id)"
              class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer"
              :class="
                u.isActive
                  ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                  : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
              "
            >
              {{ u.isActive ? 'Nonaktifkan' : 'Aktifkan Akun' }}
            </button>
          </div>
        </div>

        <!-- Hardware Key Pill -->
        <div v-if="u.webAuthnKeys && u.webAuthnKeys.length" class="flex items-center gap-2 flex-wrap text-xs pt-1">
          <span class="text-slate-400 text-[11px] font-semibold">Kunci Fisik YubiKey:</span>
          <div
            v-for="k in u.webAuthnKeys"
            :key="k.id"
            class="px-2.5 py-1 rounded-lg bg-violet-950/60 border border-violet-500/40 text-violet-300 font-mono text-[11px] flex items-center gap-1.5"
          >
            <span>🛡️</span>
            <span>{{ k.name || 'YubiKey Token' }}</span>
          </div>
        </div>

        <!-- RBAC App Role Matrix Selector -->
        <div class="pt-3 border-t border-slate-800/80 space-y-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Hak Akses Aplikasi & Granular Permissions
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <div
              v-for="c in clients"
              :key="c.slug"
              class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
            >
              <div class="flex items-center justify-between text-xs font-bold text-white truncate">
                <span>{{ c.icon }} {{ c.name }}</span>
              </div>
              <select
                :value="u.globalRole === 'superadmin' ? 'superadmin' : (u.appRoles?.[c.slug] || 'none')"
                :disabled="u.globalRole === 'superadmin'"
                @change="(e: any) => updateRole(u.id, c.slug, e.target.value)"
                class="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
              >
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="none">None (Ditolak)</option>
              </select>

              <button
                type="button"
                @click="openPermsModal(u, c.slug)"
                class="w-full text-left text-[10px] text-indigo-400 hover:text-indigo-300 font-mono underline truncate cursor-pointer"
              >
                Atur Izin ({{ (u.permissions?.[c.slug] || []).length }}) →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Granular Permissions -->
    <div
      v-if="selectedUserForPerms"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-white">
            Granular Permissions: {{ selectedClientSlug }}
          </h3>
          <button @click="selectedUserForPerms = null" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300">
          Atur hak akses granular untuk <strong>{{ selectedUserForPerms.name }}</strong> pada aplikasi <code>{{ selectedClientSlug }}</code>:
        </p>

        <div class="space-y-2 max-h-60 overflow-y-auto">
          <div
            v-for="perm in (clients.find(c => c.slug === selectedClientSlug)?.availablePermissions || [
              `${selectedClientSlug}:read`,
              `${selectedClientSlug}:write`,
              `${selectedClientSlug}:admin`
            ])"
            :key="perm"
            @click="toggleUserPermission(perm)"
            class="p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all text-xs"
            :class="
              (selectedUserForPerms.permissions?.[selectedClientSlug] || []).includes(perm)
                ? 'bg-indigo-600/20 border-indigo-500/40 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            "
          >
            <span class="font-mono">{{ perm }}</span>
            <span v-if="(selectedUserForPerms.permissions?.[selectedClientSlug] || []).includes(perm)" class="text-indigo-400 font-bold">✓</span>
          </div>
        </div>

        <div class="pt-2 flex justify-end">
          <button
            @click="selectedUserForPerms = null"
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
