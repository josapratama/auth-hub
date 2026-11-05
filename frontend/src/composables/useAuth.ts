import { ref, computed } from "vue";
import type { AuthUser } from "../types/index.js";
import { useToast } from "./useToast.js";

const adminToken = ref<string>(localStorage.getItem("authhub_admin_token") || "");
const currentAdmin = ref<AuthUser | null>(
  localStorage.getItem("authhub_admin_user")
    ? JSON.parse(localStorage.getItem("authhub_admin_user")!)
    : null
);
const activeTab = ref<string>("overview");

export function useAuth() {
  const { showToast } = useToast();
  const isLoggedIn = computed(() => Boolean(adminToken.value && currentAdmin.value));

  function setAuth(token: string, user: AuthUser) {
    adminToken.value = token;
    currentAdmin.value = user;
    localStorage.setItem("authhub_admin_token", token);
    localStorage.setItem("authhub_admin_user", JSON.stringify(user));
  }

  function clearAuth() {
    adminToken.value = "";
    currentAdmin.value = null;
    localStorage.removeItem("authhub_admin_token");
    localStorage.removeItem("authhub_admin_user");
  }

  async function logout() {
    try {
      if (adminToken.value) {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken.value}`,
          },
        });
      }
    } catch (e) {
      console.warn("Logout request failed", e);
    } finally {
      clearAuth();
      showToast("Anda telah keluar dari AuthHub Dashboard.");
    }
  }

  async function apiFetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    if (adminToken.value) {
      headers.set("Authorization", `Bearer ${adminToken.value}`);
    }
    if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearAuth();
      showToast("Sesi Anda telah kedaluwarsa. Silakan masuk kembali.");
    }
    return res;
  }

  return {
    adminToken,
    currentAdmin,
    isLoggedIn,
    activeTab,
    setAuth,
    clearAuth,
    logout,
    apiFetch,
  };
}
