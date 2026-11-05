<script setup lang="ts">
import { ref } from "vue";
import { startRegistration } from "@simplewebauthn/browser";
import { useAuth } from "../../composables/useAuth.js";
import { useToast } from "../../composables/useToast.js";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits(["close", "registered"]);
const { apiFetch } = useAuth();
const { showToast } = useToast();

const keyName = ref("YubiKey 5 NFC (Hardware Token)");
const loading = ref(false);
const error = ref("");

async function handleRegisterYubiKey() {
  loading.value = true;
  error.value = "";

  try {
    // 1. Fetch WebAuthn registration options
    const optRes = await apiFetch("/api/webauthn/register/options", {
      method: "POST",
    });
    const optData = await optRes.json();
    if (!optRes.ok) {
      error.value = optData.error || "Gagal membuat opsi pendaftaran YubiKey";
      return;
    }

    // 2. Invoke browser WebAuthn ceremony (prompts for PIN and physical touch)
    const attResp = await startRegistration(optData);

    // 3. Verify registration response on backend
    const verifyRes = await apiFetch("/api/webauthn/register/verify", {
      method: "POST",
      body: JSON.stringify({
        response: attResp,
        keyName: keyName.value,
      }),
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      error.value = verifyData.error || "Verifikasi YubiKey gagal";
      return;
    }

    showToast(verifyData.message || "✅ YubiKey berhasil didaftarkan dan diproteksi PIN!");
    emit("registered");
    emit("close");
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      error.value = "Pendaftaran dibatalkan atau waktu habis.";
    } else {
      error.value = err.message || "Gagal mendaftarkan YubiKey.";
    }
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
          <span>🔑 Daftarkan Kunci Fisik YubiKey (PIN)</span>
        </h3>
        <button @click="emit('close')" class="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
      </div>

      <div v-if="error" class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
        {{ error }}
      </div>

      <div class="p-4 rounded-2xl bg-violet-950/40 border border-violet-500/30 text-xs text-violet-300 space-y-2">
        <p class="font-bold">Langkah Pendaftaran Kunci:</p>
        <ol class="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
          <li>Masukkan nama alias untuk YubiKey Anda.</li>
          <li>Klik <strong>Mulai Registrasi</strong>.</li>
          <li>Masukkan <strong>User PIN FIDO2</strong> saat diminta oleh browser.</li>
          <li>Sentuh sensor kontak emas pada YubiKey Anda.</li>
        </ol>
      </div>

      <div class="space-y-1 text-xs">
        <label class="font-bold text-slate-300">Nama Alias YubiKey</label>
        <input
          v-model="keyName"
          type="text"
          required
          placeholder="YubiKey 5 NFC / Security Key"
          class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
        />
      </div>

      <div class="pt-3 flex justify-end gap-2 text-xs">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold"
        >
          Batal
        </button>
        <button
          type="button"
          @click="handleRegisterYubiKey"
          :disabled="loading"
          class="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold disabled:opacity-50 flex items-center gap-2"
        >
          <span v-if="loading" class="animate-spin">⏳</span>
          <span v-else>🛡️</span>
          <span>{{ loading ? 'Menunggu PIN & Sentuhan...' : 'Mulai Registrasi' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
