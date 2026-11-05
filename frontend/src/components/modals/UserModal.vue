<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits(["close", "created"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const form = ref({
  name: "",
  email: "",
  username: "",
  password: "",
  globalRole: "member",
});
const loading = ref(false);
const error = ref("");

async function handleSubmit() {
  loading.value = true;
  error.value = "";

  try {
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(form.value),
    });

    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || "Gagal membuat user";
      return;
    }

    showToast(`✅ User ${data.user.name} berhasil dibuat!`);
    emit("created");
    emit("close");
  } catch (err: any) {
    error.value = err.message || "Gagal menghubungi server";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>👥 Tambah Pengguna Baru</span>
        </h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
      </div>

      <div v-if="error" class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
        {{ error }}
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-3.5 text-xs">
        <div class="space-y-1">
          <label class="font-bold text-slate-300">Nama Lengkap</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="Contoh: Dr. Budi Santoso"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="font-bold text-slate-300">Email</label>
            <input
              v-model="form.email"
              type="email"
              required
              placeholder="budi@campus.ac.id"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>
          <div class="space-y-1">
            <label class="font-bold text-slate-300">Username SSO</label>
            <input
              v-model="form.username"
              type="text"
              required
              placeholder="budi_santoso"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Password Awal</label>
          <input
            v-model="form.password"
            type="password"
            required
            placeholder="Minimal 6 karakter"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Peran Global (Global Role)</label>
          <select
            v-model="form.globalRole"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white cursor-pointer"
          >
            <option value="member">Member (Dosen / Mahasiswa)</option>
            <option value="admin">Administrator</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>

        <div class="pt-3 flex justify-end gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
          >
            {{ loading ? 'Membuat...' : 'Buat Pengguna' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
