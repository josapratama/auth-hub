import { ref } from "vue";

const toastMessage = ref("");
const toastVisible = ref(false);
let toastTimer: any = null;

export function useToast() {
  function showToast(msg: string, duration = 3000) {
    toastMessage.value = msg;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible.value = false;
    }, duration);
  }

  function hideToast() {
    toastVisible.value = false;
  }

  return {
    toastMessage,
    toastVisible,
    showToast,
    hideToast,
  };
}
