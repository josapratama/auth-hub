<script setup lang="ts">
import { useToast } from "../../composables/useToast.js";

const { toastMessage, toastVisible, hideToast } = useToast();
</script>

<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-y-4 opacity-0 scale-95"
    enter-to-class="transform translate-y-0 opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-y-0 opacity-100 scale-100"
    leave-to-class="transform translate-y-4 opacity-0 scale-95"
  >
    <div
      v-if="toastVisible"
      class="fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl shadow-indigo-950/60 flex items-center gap-3"
    >
      <span class="text-xl shrink-0">🛡️</span>
      <div class="flex-1 text-xs font-semibold leading-relaxed">
        {{ toastMessage }}
      </div>
      <button
        @click="hideToast"
        class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer"
        aria-label="Tutup Notifikasi"
      >
        ✕
      </button>
    </div>
  </transition>
</template>
