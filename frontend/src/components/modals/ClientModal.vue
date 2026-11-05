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
  slug: "",
  description: "",
  icon: "🚀",
  homepageUrl: "",
  redirectUris: "",
  techStack: "",
});
const loading = ref(false);
const error = ref("");

function handleNameInput() {
  if (!form.value.slug) {
    form.value.slug = form.value.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
}

async function handleSubmit() {
  loading.value = true;
  error.value = "";

  try {
    const uris = form.value.redirectUris
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const res = await apiFetch("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        ...form.value,
        redirectUris: uris,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      error.value = data.error || "Gagal mendaftarkan klien";
      return;
    }

    showToast(`✅ Aplikasi ${data.client.name} berhasil didaftarkan!`);
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
    <div class="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <span>🚀 Daftarkan Aplikasi Klien Baru</span>
        </h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
      </div>

      <div v-if="error" class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
        {{ error }}
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-3.5 text-xs">
        <div class="grid grid-cols-4 gap-3">
          <div class="col-span-1 space-y-1">
            <label class="font-bold text-slate-300">Ikon Emoji</label>
            <input
              v-model="form.icon"
              type="text"
              class="w-full text-center px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-lg"
            />
          </div>
          <div class="col-span-3 space-y-1">
            <label class="font-bold text-slate-300">Nama Aplikasi</label>
            <input
              v-model="form.name"
              @input="handleNameInput"
              type="text"
              required
              placeholder="Contoh: Portal Dosen"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Slug Identifier (Unik)</label>
          <input
            v-model="form.slug"
            type="text"
            required
            placeholder="portal-dosen"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
          />
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Deskripsi Singkat</label>
          <input
            v-model="form.description"
            type="text"
            placeholder="Aplikasi penilaian tesis dan bimbingan"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Tech Stack</label>
          <input
            v-model="form.techStack"
            type="text"
            placeholder="Laravel / Next.js / FastAPI"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
        </div>

        <div class="space-y-1">
          <label class="font-bold text-slate-300">Callback / Redirect URIs (Satu per baris)</label>
          <textarea
            v-model="form.redirectUris"
            rows="3"
            placeholder="https://app.domain.com/auth/callback&#10;http://localhost:8000/auth/callback"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
          />
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
            {{ loading ? 'Mendaftarkan...' : 'Simpan Klien' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
