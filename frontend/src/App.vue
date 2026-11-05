<template>
  <div class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
    <!-- Ambient Background Glow -->
    <div class="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none"></div>
    <div class="fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none"></div>

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/85 backdrop-blur-xl px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white">Auth<span class="text-indigo-400">Hub</span></h1>
            <span class="hidden xs:inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SSO &bull; OAuth2 &bull; YubiKey PIN
            </span>
          </div>
          <p class="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-none">Pusat Identitas &amp; Single Sign-On Seluruh Project Ekosistem</p>
        </div>
      </div>

      <!-- Right Actions (Authenticated) -->
      <div v-if="isLoggedIn" class="flex items-center gap-2 sm:gap-2.5">
        <button
          @click="openWebAuthnModal"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-xs font-bold text-violet-300 transition-colors cursor-pointer"
          title="Kelola YubiKey & Hardware Security Key"
        >
          <span>🛡️</span>
          <span class="hidden sm:inline">YubiKey PIN</span>
          <span v-if="myWebAuthnKeys.length > 0" class="px-1.5 py-0.2 rounded-full bg-violet-500/30 text-[10px]">{{ myWebAuthnKeys.length }}</span>
        </button>

        <button
          @click="activeTab = 'simulator'"
          class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 transition-colors cursor-pointer"
        >
          <span>🧪</span>
          <span>Simulasi SSO</span>
        </button>

        <button
          @click="showAddUserModal = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <span>+</span>
          <span class="hidden sm:inline">User Baru</span>
        </button>

        <button
          @click="showAddClientModal = true"
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
        >
          <span>+</span>
          <span class="hidden sm:inline">Tambah Project</span>
        </button>

        <!-- Admin Profile Pill & Logout Button -->
        <div class="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div class="hidden lg:flex flex-col text-right">
            <span class="text-xs font-bold text-white">{{ currentAdmin?.name || 'Root Admin' }}</span>
            <span class="text-[10px] text-indigo-400 font-mono uppercase">{{ currentAdmin?.globalRole || 'superadmin' }}</span>
          </div>
          <button
            @click="handleAdminLogout"
            class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Keluar dari sesi Admin"
          >
            <span>🚪</span>
            <span class="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      <!-- Right Info (Unauthenticated) -->
      <div v-else class="flex items-center gap-2">
        <span class="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>FIDO2 &bull; YubiKey PIN Ready</span>
        </span>
      </div>
    </header>

    <!-- Main Container (Authenticated Dashboard) -->
    <main v-if="isLoggedIn" class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <!-- KPI Summary Bar -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">OAuth Clients</p>
            <p class="text-xl sm:text-2xl font-extrabold text-white mt-1">{{ stats.totalClients }} <span class="text-xs font-normal text-indigo-400">Project</span></p>
          </div>
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-lg">🏢</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Pengguna</p>
            <p class="text-xl sm:text-2xl font-extrabold text-white mt-1">{{ stats.totalUsers }} <span class="text-xs font-normal text-violet-400">Akun</span></p>
          </div>
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-lg">👥</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sesi JWT Aktif</p>
            <p class="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">{{ stats.activeSessions }} <span class="text-xs font-normal text-slate-400">Token</span></p>
          </div>
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg">🔑</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">Audit Keamanan</p>
            <p class="text-xl sm:text-2xl font-extrabold text-amber-400 mt-1">{{ stats.totalAuditEvents }} <span class="text-xs font-normal text-slate-400">Event</span></p>
          </div>
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg">🛡️</div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 border-b border-slate-800 no-scrollbar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2"
          :class="
            activeTab === tab.id
              ? 'border-indigo-500 text-white bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          "
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 1: INTERACTIVE SSO FLOW SIMULATOR (HOW IT WORKS)               -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'simulator'" class="space-y-6">
        <!-- Architecture Visual Diagram Banner -->
        <div class="glass-card rounded-2xl p-5 border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-emerald-950/30">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold">
                <span>⚡ Cara Kerja Single Sign-On (OAuth2 + JWT)</span>
              </div>
              <h2 class="text-base sm:text-lg font-bold text-white">Satu Pintu Login untuk Mini VPS Panel &amp; Seluruh Project Anda</h2>
              <p class="text-xs text-slate-300 leading-relaxed max-w-3xl">
                Pilih aplikasi di bawah, pilih akun pengguna, lalu klik <strong>"Simulasikan Login SSO"</strong>. Anda akan melihat bagaimana <strong>AuthHub</strong> memvalidasi izin (RBAC), menerbitkan <code>authorization_code</code>, menukarnya menjadi <code>JWT Token</code>, serta pengujian pemutusan sesi terpusat (<em>Global Kill-Switch</em>).
              </p>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center shrink-0 text-[11px]">
              <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                <div class="text-base mb-0.5">1️⃣</div>
                <div class="font-bold text-white">Klik Login</div>
                <div class="text-[10px] text-slate-400">Di App Tujuan</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                <div class="text-base mb-0.5">2️⃣</div>
                <div class="font-bold text-indigo-300">Auth &amp; RBAC</div>
                <div class="text-[10px] text-slate-400">Cek Izin Role</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                <div class="text-base mb-0.5">3️⃣</div>
                <div class="font-bold text-violet-300">Tukar Code</div>
                <div class="text-[10px] text-slate-400">Ke JWT Token</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
                <div class="text-base mb-0.5">4️⃣</div>
                <div class="font-bold text-emerald-300">Akses Masuk</div>
                <div class="text-[10px] text-slate-400">Semua Project</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column: Universal SSO Login Card Mockup -->
          <div class="lg:col-span-5 glass-card rounded-2xl p-5 sm:p-6 border border-slate-700/80 space-y-5 relative overflow-hidden">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
              <div class="flex items-center gap-2.5">
                <span class="text-2xl">{{ selectedSimClient?.icon || '⚡' }}</span>
                <div>
                  <span class="text-[10px] uppercase tracking-wider font-bold text-indigo-400">Target Aplikasi (Client)</span>
                  <h3 class="text-sm sm:text-base font-bold text-white">{{ selectedSimClient?.name }}</h3>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-300">
                {{ selectedSimClient?.slug }}
              </span>
            </div>

            <!-- 1. Select Target App -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">1. Pilih Aplikasi yang Ingin Diakses:</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                <button
                  v-for="c in clients"
                  :key="c.id"
                  @click="simForm.clientSlug = c.slug"
                  class="px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-1.5 truncate cursor-pointer"
                  :class="
                    simForm.clientSlug === c.slug
                      ? 'bg-indigo-600/25 border-indigo-500 text-white font-bold'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                  "
                >
                  <span class="shrink-0">{{ c.icon }}</span>
                  <span class="text-[11px] truncate">{{ c.name }}</span>
                </button>
              </div>
            </div>

            <!-- 2. Quick Account Presets (Dynamic from loaded users) -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">2. Pilih Akun Pengguna (1-Klik Isi Otomatis):</label>
              <div class="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                <button
                  v-for="u in users"
                  :key="u.id"
                  @click="selectUserForSimulation(u)"
                  class="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border flex items-center justify-between text-xs transition-colors cursor-pointer"
                  :class="simForm.identifier === u.email || simForm.identifier === u.username ? 'border-indigo-500/80 bg-indigo-500/10' : 'border-slate-800'"
                >
                  <div class="flex items-center gap-2 truncate pr-2">
                    <span class="w-2 h-2 rounded-full shrink-0" :class="u.isActive !== false ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                    <span class="font-bold text-white truncate">{{ u.name }}</span>
                    <span class="text-slate-400 text-[11px] truncate">({{ u.email }})</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span
                      class="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                      :class="u.globalRole === 'superadmin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-300'"
                    >
                      {{ u.globalRole }}
                    </span>
                    <span v-if="u.webAuthnKeys && u.webAuthnKeys.length" class="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[9px] font-bold" title="YubiKey Aktif">
                      🛡️ {{ u.webAuthnKeys.length }}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 3. Credentials Input -->
            <div class="space-y-3 pt-1">
              <div>
                <label class="block text-[11px] font-semibold text-slate-400 mb-1">Email atau Username SSO</label>
                <input
                  v-model="simForm.identifier"
                  type="text"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="josapratama@minihost.local"
                />
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-400 mb-1">Password</label>
                <input
                  v-model="simForm.password"
                  type="password"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <!-- 2FA Input if required -->
              <div v-if="simDemoTotp" class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <label class="text-xs font-bold text-amber-300 flex items-center justify-between">
                  <span>Kode 2FA TOTP:</span>
                  <span class="font-mono text-emerald-400">Kode Demo: {{ simDemoTotp }}</span>
                </label>
                <input
                  v-model="simForm.totpCode"
                  type="text"
                  placeholder="Masukkan 6-digit OTP"
                  class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 text-center font-mono tracking-widest text-sm focus:outline-none"
                />
              </div>
            </div>

            <!-- Error Banner -->
            <div
              v-if="simError"
              class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 space-y-1"
            >
              <div class="font-bold text-rose-400 flex items-center gap-1.5">
                <span>⛔</span>
                <span>Otentikasi / Akses Ditolak oleh AuthHub</span>
              </div>
              <p>{{ simError }}</p>
              <p v-if="simDemoTotp" class="text-emerald-300 font-mono mt-1">
                💡 Kode TOTP saat ini: <strong>{{ simDemoTotp }}</strong>
              </p>
            </div>

            <!-- Submit Button -->
            <button
              @click="runSsoSimulation"
              :disabled="simLoading"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>🔐</span>
              <span>{{ simLoading ? 'Memproses Handshake OAuth2...' : `Login ke ${selectedSimClient?.name || 'Aplikasi'} via AuthHub` }}</span>
            </button>
          </div>

          <!-- Right Column: Live 4-Step Handshake & Token Inspector -->
          <div class="lg:col-span-7 space-y-4">
            <div v-if="!simResult" class="glass-card rounded-2xl p-8 sm:p-12 text-center space-y-3 border border-dashed border-slate-700">
              <div class="text-4xl">🚀</div>
              <h3 class="text-base font-bold text-white">Siap Menjalankan Simulasi Handshake SSO</h3>
              <p class="text-xs text-slate-400 max-w-md mx-auto">
                Klik tombol <strong>"Login via AuthHub"</strong> di sebelah kiri untuk melihat bagaimana request mengalir dari aplikasi menuju server AuthHub dan menghasilkan token JWT.
              </p>
            </div>

            <template v-else>
              <!-- Step-by-Step Trace Cards -->
              <div class="space-y-3">
                <div
                  v-for="s in simResult.steps"
                  :key="s.step"
                  class="glass-card rounded-2xl p-4 border border-slate-800 space-y-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center justify-center shrink-0">
                        ✓
                      </span>
                      <h4 class="text-xs sm:text-sm font-bold text-white">{{ s.title }}</h4>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono text-[11px]">
                      {{ s.protocol }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300">{{ s.description }}</p>
                  <pre class="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">{{ JSON.stringify(s.payload, null, 2) }}</pre>
                </div>
              </div>

              <!-- Live Token Verification & Global Kill-Switch Test Box -->
              <div class="glass-card rounded-2xl p-4 sm:p-5 border border-emerald-500/30 bg-emerald-950/10 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                      <span>🔬 Uji Validasi Token &amp; Global Logout (Kill-Switch)</span>
                    </h4>
                    <p class="text-xs text-slate-400">
                      Buktikan bahwa saat sesi dicabut di AuthHub, token JWT ini langsung ditolak oleh aplikasi!
                    </p>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      @click="verifySimulatedToken"
                      class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      ✓ Cek Validitas Token
                    </button>
                    <button
                      @click="revokeSimulatedSession"
                      class="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      🛑 Cabut Sesi (Kill-Switch)
                    </button>
                  </div>
                </div>

                <div
                  v-if="verifyCheckOutput"
                  class="p-3.5 rounded-xl border text-xs font-mono overflow-x-auto"
                  :class="
                    verifyCheckOutput.valid
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                  "
                >
                  <div class="font-bold mb-1">
                    {{ verifyCheckOutput.valid ? '✅ STATUS: TOKEN VALID & DIIZINKAN' : '❌ STATUS: TOKEN DITOLAK (SESI DICABUT / EXPIRED)' }}
                  </div>
                  <pre class="max-h-48 overflow-y-auto">{{ JSON.stringify(verifyCheckOutput, null, 2) }}</pre>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 2: USERS & MULTI-PROJECT RBAC MATRIX                           -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'matrix'" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-white">Matriks Hak Akses (RBAC) &amp; Pengguna</h2>
            <p class="text-xs text-slate-400">
              Kelola status akun (Aktif / Suspend), 2FA, YubiKey PIN, dan perizinan tiap aplikasi: <code>superadmin</code>, <code>admin</code>, <code>editor</code>, <code>viewer</code>, atau <code>none</code> (blokir).
            </p>
          </div>

          <div class="flex items-center gap-2">
            <!-- Search User -->
            <div class="relative w-full sm:w-64">
              <input
                v-model="userSearchQuery"
                type="text"
                placeholder="Cari user / email / role..."
                class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span class="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
            </div>

            <button
              @click="showAddUserModal = true"
              class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              + User Baru
            </button>
          </div>
        </div>

        <!-- Desktop RBAC Table View -->
        <div class="hidden lg:block glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-900/90 text-slate-300">
                  <th class="p-3.5 font-bold min-w-[210px] sticky left-0 bg-slate-900 z-10">Pengguna SSO</th>
                  <th class="p-3.5 font-bold text-center min-w-[110px]">Status Akun</th>
                  <th class="p-3.5 font-bold text-center min-w-[110px]">Keamanan Kunci</th>
                  <th
                    v-for="c in clients"
                    :key="c.id"
                    class="p-3 font-bold text-center min-w-[125px] border-l border-slate-800/70"
                  >
                    <div class="flex flex-col items-center gap-1">
                      <span class="text-base">{{ c.icon }}</span>
                      <span class="text-[11px] text-white leading-tight">{{ c.name }}</span>
                      <span class="text-[9px] font-mono text-slate-400">{{ c.slug }}</span>
                    </div>
                  </th>
                  <th class="p-3.5 font-bold text-center border-l border-slate-800/70 min-w-[130px]">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/70">
                <tr v-if="filteredUsers.length === 0">
                  <td :colspan="clients.length + 4" class="p-8 text-center text-slate-500">
                    Tidak ada akun pengguna yang cocok dengan pencarian "{{ userSearchQuery }}".
                  </td>
                </tr>

                <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-slate-800/30 transition-colors">
                  <!-- User Info -->
                  <td class="p-3.5 sticky left-0 bg-[#0d1322] z-10">
                    <div class="font-bold text-white flex items-center gap-1.5">
                      <span>{{ u.name }}</span>
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                        :class="
                          u.globalRole === 'superadmin'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-700 text-slate-300'
                        "
                      >
                        {{ u.globalRole }}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-400 font-mono">{{ u.email }}</div>
                  </td>

                  <!-- Status (Active / Suspended / Pending) -->
                  <td class="p-3.5 text-center">
                    <div class="flex flex-col items-center gap-1">
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                        :class="
                          u.isActive !== false
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                        "
                      >
                        <span class="w-1.5 h-1.5 rounded-full" :class="u.isActive !== false ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                        <span>{{ u.isActive !== false ? 'Aktif' : 'Nonaktif / Pending' }}</span>
                      </span>
                      <button
                        v-if="u.id !== 'usr_josa_root'"
                        @click="toggleUserStatus(u.id)"
                        class="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        {{ u.isActive !== false ? 'Tangguhkan' : 'Setujui / Aktifkan' }}
                      </button>
                    </div>
                  </td>

                  <!-- Security: 2FA & YubiKey -->
                  <td class="p-3.5 text-center space-y-1">
                    <div class="flex items-center justify-center gap-1">
                      <button
                        @click="toggle2FA(u.id)"
                        class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer"
                        :class="
                          u.twoFactorEnabled
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        "
                        :title="u.twoFactorEnabled ? 'TOTP 2FA Aktif' : 'TOTP 2FA Nonaktif'"
                      >
                        {{ u.twoFactorEnabled ? '🔒 2FA' : '🔓 Non-2FA' }}
                      </button>

                      <span
                        class="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                        :class="
                          (u.webAuthnKeys && u.webAuthnKeys.length) || (u.webAuthnCredentials && u.webAuthnCredentials.length)
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                        "
                        :title="((u.webAuthnKeys && u.webAuthnKeys.length) || 0) + ' YubiKey FIDO2 terdaftar'"
                      >
                        🛡️ {{ ((u.webAuthnKeys && u.webAuthnKeys.length) || (u.webAuthnCredentials && u.webAuthnCredentials.length) || 0) }} Key
                      </span>
                    </div>
                    <div v-if="u.twoFactorEnabled && u.currentTotpDemo" class="text-[9px] font-mono text-emerald-400">
                      OTP: {{ u.currentTotpDemo }}
                    </div>
                  </td>

                  <!-- Per-Project Role Selector -->
                  <td
                    v-for="c in clients"
                    :key="c.id"
                    class="p-2.5 text-center border-l border-slate-800/50"
                  >
                    <select
                      :value="u.appRoles?.[c.slug] || 'none'"
                      @change="onRoleChange(u.id, c.slug, ($event.target as HTMLSelectElement).value)"
                      class="px-2 py-1.5 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer w-full text-center"
                      :class="roleBadgeClass(u.appRoles?.[c.slug] || 'none')"
                    >
                      <option value="superadmin" class="bg-slate-900 text-indigo-300">SUPERADMIN</option>
                      <option value="admin" class="bg-slate-900 text-emerald-300">ADMIN</option>
                      <option value="editor" class="bg-slate-900 text-amber-300">EDITOR</option>
                      <option value="viewer" class="bg-slate-900 text-sky-300">VIEWER</option>
                      <option value="none" class="bg-slate-900 text-rose-400">NONE (BLOKIR)</option>
                    </select>
                  </td>

                  <!-- Actions -->
                  <td class="p-3.5 text-center border-l border-slate-800/50">
                    <div class="flex items-center justify-center gap-1.5">
                      <button
                        @click="revokeAllForUser(u.id)"
                        class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold cursor-pointer"
                        title="Logout paksa dari semua aplikasi"
                      >
                        Kill Sessions
                      </button>
                      <button
                        v-if="u.id !== 'usr_josa_root'"
                        @click="deleteUser(u.id)"
                        class="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold cursor-pointer"
                        title="Hapus akun"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile & Tablet Card View for Users & RBAC -->
        <div class="block lg:hidden space-y-3">
          <div v-if="filteredUsers.length === 0" class="glass-card rounded-2xl p-6 text-center text-xs text-slate-500">
            Tidak ada akun pengguna yang cocok.
          </div>

          <div
            v-for="u in filteredUsers"
            :key="u.id"
            class="glass-card rounded-2xl p-4 border border-slate-800 space-y-3.5"
          >
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-white">{{ u.name }}</h3>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                    :class="u.globalRole === 'superadmin' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-300'"
                  >
                    {{ u.globalRole }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 font-mono">{{ u.email }}</p>
              </div>

              <!-- Status Pill -->
              <span
                class="px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 shrink-0"
                :class="
                  u.isActive !== false
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                "
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="u.isActive !== false ? 'bg-emerald-400' : 'bg-amber-400'"></span>
                <span>{{ u.isActive !== false ? 'Aktif' : 'Nonaktif' }}</span>
              </span>
            </div>

            <!-- Controls row -->
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
              <div class="flex items-center gap-1.5">
                <button
                  @click="toggle2FA(u.id)"
                  class="px-2 py-1 rounded-lg font-bold border transition-all text-[10px]"
                  :class="
                    u.twoFactorEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  "
                >
                  {{ u.twoFactorEnabled ? '🔒 2FA' : '🔓 Non-2FA' }}
                </button>
                <span
                  class="px-2 py-1 rounded-lg text-[10px] font-bold border bg-violet-500/15 border-violet-500/30 text-violet-300"
                >
                  🛡️ {{ ((u.webAuthnKeys && u.webAuthnKeys.length) || (u.webAuthnCredentials && u.webAuthnCredentials.length) || 0) }} Key
                </span>
                <button
                  v-if="u.id !== 'usr_josa_root'"
                  @click="toggleUserStatus(u.id)"
                  class="px-2 py-1 rounded-lg border text-[10px] font-semibold"
                  :class="u.isActive !== false ? 'border-amber-500/30 text-amber-300 bg-amber-500/10' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'"
                >
                  {{ u.isActive !== false ? 'Suspend' : 'Aktifkan' }}
                </button>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  @click="revokeAllForUser(u.id)"
                  class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[10px] font-bold"
                >
                  Kill
                </button>
                <button
                  v-if="u.id !== 'usr_josa_root'"
                  @click="deleteUser(u.id)"
                  class="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] font-bold"
                >
                  Hapus
                </button>
              </div>
            </div>

            <!-- Role Matrix in accordion / grid -->
            <div class="space-y-2 pt-1 border-t border-slate-800/80">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Perizinan Aplikasi (RBAC):</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  v-for="c in clients"
                  :key="c.id"
                  class="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div class="flex items-center gap-1.5 truncate">
                    <span>{{ c.icon }}</span>
                    <span class="text-xs text-white truncate">{{ c.name }}</span>
                  </div>
                  <select
                    :value="u.appRoles?.[c.slug] || 'none'"
                    @change="onRoleChange(u.id, c.slug, ($event.target as HTMLSelectElement).value)"
                    class="px-2 py-1 rounded-lg text-[10px] font-bold border focus:outline-none cursor-pointer"
                    :class="roleBadgeClass(u.appRoles?.[c.slug] || 'none')"
                  >
                    <option value="superadmin" class="bg-slate-900 text-indigo-300">SUPERADMIN</option>
                    <option value="admin" class="bg-slate-900 text-emerald-300">ADMIN</option>
                    <option value="editor" class="bg-slate-900 text-amber-300">EDITOR</option>
                    <option value="viewer" class="bg-slate-900 text-sky-300">VIEWER</option>
                    <option value="none" class="bg-slate-900 text-rose-400">BLOKIR</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 3: CONNECTED ECOSYSTEM APPS (OAUTH2 CLIENTS)                   -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'clients'" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-white">Daftar Project &amp; OAuth2 Clients ({{ clients.length }} Aplikasi)</h2>
            <p class="text-xs text-slate-400">Setiap aplikasi memiliki <code>client_id</code> dan <code>client_secret</code> unik untuk memverifikasi handshake SSO.</p>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative w-full sm:w-56">
              <input
                v-model="clientSearchQuery"
                type="text"
                placeholder="Cari project..."
                class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span class="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
            </div>

            <button
              @click="showAddClientModal = true"
              class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              + Project
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="c in filteredClients"
            :key="c.id"
            class="glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-2xl shrink-0">
                    {{ c.icon }}
                  </div>
                  <div class="truncate">
                    <h3 class="text-sm font-bold text-white truncate">{{ c.name }}</h3>
                    <span class="text-[11px] font-mono text-indigo-400">{{ c.slug }}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-semibold shrink-0">
                  {{ c.techStack }}
                </span>
              </div>

              <p class="text-xs text-slate-400 line-clamp-2">{{ c.description }}</p>

              <!-- Credentials Box with Show/Hide Secret -->
              <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 text-[11px] font-mono">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-400">client_id:</span>
                  <button
                    @click="copyText(c.clientId)"
                    class="text-indigo-300 hover:underline truncate cursor-pointer"
                    title="Klik untuk salin"
                  >
                    {{ c.clientId }}
                  </button>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400">secret:</span>
                    <button
                      @click="toggleSecretVisibility(c.id)"
                      class="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                      :title="visibleSecrets[c.id] ? 'Sembunyikan Secret' : 'Lihat Secret'"
                    >
                      {{ visibleSecrets[c.id] ? '🙈' : '👁️' }}
                    </button>
                  </div>
                  <button
                    @click="copyText(c.clientSecret)"
                    class="text-emerald-300 hover:underline truncate max-w-[180px] cursor-pointer"
                    title="Klik untuk salin Client Secret"
                  >
                    {{ visibleSecrets[c.id] ? c.clientSecret : '••••••••••••••••••••' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                @click="openSdkForClient(c.slug)"
                class="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold transition-colors cursor-pointer"
              >
                🔌 Kode Integrasi
              </button>
              <div class="flex items-center gap-1.5">
                <button
                  @click="rotateSecret(c.id)"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                  title="Putar ulang Client Secret"
                >
                  🔄 Rotate
                </button>
                <button
                  v-if="c.slug !== 'minihost'"
                  @click="deleteClient(c.id)"
                  class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-semibold cursor-pointer"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 4: ACTIVE SESSIONS & SECURITY AUDIT LOGS                       -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'sessions'" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Active Sessions -->
        <div class="lg:col-span-6 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span>🔑 Sesi JWT Aktif</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">{{ sessions.length }}</span>
            </h2>
          </div>

          <div class="glass-card rounded-2xl divide-y divide-slate-800/80 overflow-hidden max-h-[560px] overflow-y-auto">
            <div v-if="sessions.length === 0" class="p-8 text-center text-xs text-slate-400">
              Belum ada sesi login aktif. Coba jalankan login di tab <strong>Simulasi SSO</strong>!
            </div>
            <div
              v-for="s in sessions"
              :key="s.id"
              class="p-4 flex items-center justify-between gap-3"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-bold text-white">{{ s.userName }}</span>
                  <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                    {{ s.clientName }} ({{ s.appRole }})
                  </span>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                    :class="s.revoked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'"
                  >
                    {{ s.revoked ? 'REVOKED' : 'ACTIVE' }}
                  </span>
                </div>
                <div class="text-[11px] font-mono text-slate-400 truncate max-w-xs sm:max-w-md">
                  {{ s.id }} &bull; IP: {{ s.ipAddress }}
                </div>
              </div>
              <button
                v-if="!s.revoked"
                @click="revokeSessionById(s.id)"
                class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold shrink-0 cursor-pointer"
              >
                Cabut Akses
              </button>
            </div>
          </div>
        </div>

        <!-- Security Audit Trail -->
        <div class="lg:col-span-6 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-white">🛡️ Riwayat Audit Keamanan (Real-Time)</h2>
            <span class="text-xs text-slate-400 font-mono">{{ auditLogs.length }} Event</span>
          </div>

          <div class="glass-card rounded-2xl divide-y divide-slate-800/80 max-h-[560px] overflow-y-auto">
            <div
              v-for="log in auditLogs"
              :key="log.id"
              class="p-3.5 space-y-1 text-xs"
            >
              <div class="flex items-center justify-between gap-2">
                <span
                  class="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
                  :class="
                    log.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : log.status === 'warning'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-rose-500/15 text-rose-300'
                  "
                >
                  {{ log.event }}
                </span>
                <span class="text-[10px] text-slate-400 font-mono">
                  {{ new Date(log.timestamp).toLocaleTimeString() }}
                </span>
              </div>
              <p class="text-slate-200">{{ log.details }}</p>
              <div class="text-[10px] text-slate-400 font-mono">
                User: {{ log.userEmail }} {{ log.clientSlug ? `• App: ${log.clientSlug}` : '' }} • IP: {{ log.ipAddress }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 5: SETTINGS & REGISTRATION POLICY                              -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'settings'" class="space-y-6 max-w-4xl">
        <div class="space-y-1">
          <h2 class="text-base sm:text-lg font-bold text-white">⚙️ Kebijakan Sistem &amp; Registrasi Pengguna</h2>
          <p class="text-xs text-slate-400">
            Atur apakah pengguna umum dapat mendaftar mandiri (Self-Registration) dan tentukan aplikasi mana yang otomatis dapat diakses oleh akun baru.
          </p>
        </div>

        <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-6">
          <!-- Toggle 1: Allow Public Registration -->
          <div class="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-white">Izinkan Pendaftaran Akun Mandiri (Self-Registration)</h3>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="settings.allowPublicRegistration ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'"
                >
                  {{ settings.allowPublicRegistration ? 'DIIZINKAN' : 'DITUTUP' }}
                </span>
              </div>
              <p class="text-xs text-slate-400">
                Jika diaktifkan, portal pendaftaran publik di halaman utama akan terbuka sehingga pengguna umum atau anggota tim baru dapat membuat akun sendiri.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" v-model="settings.allowPublicRegistration" class="sr-only peer" />
              <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <!-- Toggle 2: Require Admin Approval -->
          <div class="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-white">Wajib Persetujuan Admin (Approval Workflow)</h3>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="settings.requireAdminApproval ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'"
                >
                  {{ settings.requireAdminApproval ? 'APPROVAL AKTIF' : 'AUTO-APPROVE' }}
                </span>
              </div>
              <p class="text-xs text-slate-400">
                Jika diaktifkan, akun yang baru mendaftar akan berstatus <strong>Pending / Nonaktif</strong> dan tidak bisa login sebelum disetujui secara manual oleh Administrator di tab Pengguna.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" v-model="settings.requireAdminApproval" class="sr-only peer" />
              <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <!-- Section 3: Automatic Public Client Roles -->
          <div class="space-y-3 pb-6 border-b border-slate-800">
            <div>
              <h3 class="text-sm font-bold text-white">Aplikasi Terbuka Otomatis untuk User Baru</h3>
              <p class="text-xs text-slate-400">
                Pilih aplikasi mana saja yang otomatis memberikan hak akses (role <code>viewer</code>) saat ada user baru mendaftar. Aplikasi penting (seperti Mini VPS Panel) tetap berstatus <code>none</code> (diblokir) demi keamanan.
              </p>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label
                v-for="c in clients"
                :key="c.id"
                class="p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors"
                :class="
                  settings.publicClientSlugs.includes(c.slug)
                    ? 'bg-indigo-500/15 border-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                "
              >
                <input
                  type="checkbox"
                  :value="c.slug"
                  v-model="settings.publicClientSlugs"
                  class="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                />
                <span class="text-base">{{ c.icon }}</span>
                <span class="text-xs truncate">{{ c.name }}</span>
              </label>
            </div>
          </div>

          <!-- Section 4: Default Role Info -->
          <div class="flex items-center justify-between text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <span class="text-slate-400">Default Global Role Pengguna Baru:</span>
            <span class="font-mono font-bold text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-500/20">
              {{ settings.defaultMemberRole }}
            </span>
          </div>

          <!-- Save Button -->
          <div class="flex justify-end pt-2">
            <button
              @click="saveSettings"
              :disabled="savingSettings"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>💾</span>
              <span>{{ savingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Kebijakan SSO' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 6: PLUG & PLAY SDK CODE GENERATOR                              -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'sdk'" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-bold text-white">🔌 Generator Kode Integrasi (Plug &amp; Play SDK)</h2>
            <p class="text-xs text-slate-400">
              Pilih aplikasi yang ingin diintegrasikan, lalu salin snippet middleware siap pakai untuk <strong>Node.js/Express</strong>, <strong>Python FastAPI</strong>, atau <strong>Frontend</strong>.
            </p>
          </div>
          <select
            v-model="selectedSdkClient"
            @change="fetchSdkSnippets"
            class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-indigo-300 cursor-pointer"
          >
            <option v-for="c in clients" :key="c.id" :value="c.slug">
              {{ c.icon }} {{ c.name }} ({{ c.slug }})
            </option>
          </select>
        </div>

        <div v-if="sdkSnippets" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="glass-card rounded-2xl p-4 space-y-3 flex flex-col">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-400">🟢 Node.js / Express Middleware</span>
              <button @click="copyText(sdkSnippets.express)" class="text-xs text-indigo-300 hover:underline cursor-pointer">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.express }}</pre>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-3 flex flex-col">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-sky-400">🐍 Python FastAPI (Mini VPS Panel)</span>
              <button @click="copyText(sdkSnippets.fastapi)" class="text-xs text-indigo-300 hover:underline cursor-pointer">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.fastapi }}</pre>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-3 flex flex-col">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-violet-400">⚛️ Frontend (React / Vue / Next.js)</span>
              <button @click="copyText(sdkSnippets.frontend)" class="text-xs text-indigo-300 hover:underline cursor-pointer">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.frontend }}</pre>
          </div>
        </div>
      </section>
    </main>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- PUBLIC AUTH PORTAL (LOGIN & REGISTRATION TABS)                      -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <main v-else class="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
      <div class="w-full max-w-md">
        <!-- Glowing Glass Card -->
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-indigo-500/30 bg-[#0d1322]/90 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl relative overflow-hidden space-y-5">
          <div class="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>

          <!-- Logo & Header -->
          <div class="text-center space-y-2">
            <div class="w-13 h-13 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
              <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white">AuthHub SSO Gateway</h2>
            <p class="text-xs text-slate-400">Pusat Autentikasi Terpadu &amp; Akses Lintas Project</p>
          </div>

          <!-- OAuth Request Banner (When redirected from GuidePath or another client) -->
          <div v-if="oauthClientInfo" class="p-3.5 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 flex items-center gap-3">
            <span class="text-2xl shrink-0">{{ oauthClientInfo.icon || '🎓' }}</span>
            <div class="space-y-0.5 truncate text-left">
              <div class="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Permintaan Single Sign-On</div>
              <div class="text-xs font-bold text-white truncate">Login untuk melanjutkan ke {{ oauthClientInfo.name }}</div>
            </div>
          </div>

          <!-- Switcher Pill: Masuk vs Daftar Akun -->
          <div class="p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1">
            <button
              @click="authPortalTab = 'login'"
              class="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="authPortalTab === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >
              <span>🔑</span>
              <span>Masuk (Login)</span>
            </button>
            <button
              @click="authPortalTab = 'register'"
              class="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              :class="authPortalTab === 'register' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'"
            >
              <span>✨</span>
              <span>Daftar Akun Baru</span>
            </button>
          </div>

          <!-- ─── SUB-VIEW 1: LOGIN FORM ─── -->
          <template v-if="authPortalTab === 'login'">
            <!-- Login Method Switcher: Password vs YubiKey PIN -->
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <button
                type="button"
                @click="loginMode = 'password'"
                class="flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="loginMode === 'password' ? 'bg-indigo-600/40 text-white border border-indigo-500/40' : 'text-slate-400 hover:text-white'"
              >
                <span>🔑 Password &amp; 2FA</span>
              </button>
              <button
                type="button"
                @click="loginMode = 'yubikey'"
                class="flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                :class="loginMode === 'yubikey' ? 'bg-gradient-to-r from-violet-600/50 to-emerald-600/50 text-white border border-violet-500/50' : 'text-slate-400 hover:text-white'"
              >
                <span>🛡️ YubiKey (PIN)</span>
              </button>
            </div>

            <!-- MODE A: PASSWORD LOGIN -->
            <template v-if="loginMode === 'password'">
              <!-- Error Alert Banner -->
              <div v-if="loginError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <span class="text-base shrink-0">⚠️</span>
                <div class="space-y-1">
                  <p class="font-bold">Gagal Masuk</p>
                  <p class="leading-relaxed">{{ loginError }}</p>
                </div>
              </div>

              <!-- Login Form -->
              <form @submit.prevent="handleAdminLogin" class="space-y-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-slate-300">Email atau Username SSO</label>
                  <input
                    v-model="loginForm.identifier"
                    type="text"
                    required
                    autocomplete="username"
                    placeholder="josapratama@minihost.local"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-slate-300">Password</label>
                  <input
                    v-model="loginForm.password"
                    type="password"
                    required
                    autocomplete="current-password"
                    placeholder="••••••••"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <!-- 2FA TOTP Code (If required) -->
                <div v-if="loginRequire2fa" class="space-y-1.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <label class="text-xs font-bold text-amber-300 flex items-center justify-between">
                    <span>Kode 2FA Authenticator</span>
                    <span v-if="loginDemoTotp" class="font-mono text-[11px] text-amber-400">Demo Code: {{ loginDemoTotp }}</span>
                  </label>
                  <input
                    v-model="loginForm.totpCode"
                    type="text"
                    maxlength="6"
                    placeholder="6-digit code"
                    class="w-full px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-center font-mono tracking-widest text-base focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  :disabled="loginLoading"
                  class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span v-if="loginLoading" class="animate-spin text-base">⏳</span>
                  <span v-else>🛡️</span>
                  <span>{{ loginLoading ? 'Memverifikasi...' : 'Masuk ke AuthHub' }}</span>
                </button>
              </form>

              <!-- Quick Fill Root Admin -->
              <div class="pt-2 border-t border-slate-800 text-center">
                <button
                  type="button"
                  @click="fillDemoRootAdmin"
                  class="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⚡</span>
                  <span>Isi Akun Root Superadmin (josapratama@minihost.local)</span>
                </button>
              </div>
            </template>

            <!-- MODE B: YUBIKEY PIN AUTHENTICATION -->
            <template v-else>
              <div class="space-y-4">
                <div class="p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 via-slate-900/90 to-emerald-950/30 border border-violet-500/30 space-y-2">
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xl">🛡️</span>
                    <div>
                      <h3 class="text-xs font-bold text-white">Autentikasi Hardware YubiKey (FIDO2)</h3>
                      <p class="text-[11px] text-slate-400">Proteksi tingkat tinggi dengan User PIN &amp; sensor sentuh fisik.</p>
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-300 leading-relaxed">
                    Colokkan perangkat YubiKey Anda (USB / NFC). Ketika browser memunculkan prompt keamanan, masukkan <strong>User PIN YubiKey</strong> Anda dan sentuh sensor logam.
                  </p>
                </div>

                <!-- Error Alert -->
                <div v-if="yubikeyError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                  <span class="text-base shrink-0">⚠️</span>
                  <div class="space-y-0.5">
                    <p class="font-bold">Autentikasi YubiKey Gagal</p>
                    <p class="leading-relaxed">{{ yubikeyError }}</p>
                  </div>
                </div>

                <!-- Optional Identifier -->
                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-slate-300">Email atau Username SSO</label>
                  <input
                    v-model="yubikeyIdentifier"
                    type="text"
                    placeholder="josapratama@minihost.local"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                  <p class="text-[10px] text-slate-400">Masukkan akun Anda yang telah mendaftarkan YubiKey.</p>
                </div>

                <!-- YubiKey Trigger Button -->
                <button
                  type="button"
                  @click="handleYubikeyLogin"
                  :disabled="yubikeyLoading"
                  class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white text-sm font-bold shadow-lg shadow-violet-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span v-if="yubikeyLoading" class="animate-spin text-base">⏳</span>
                  <span v-else class="text-lg">🔐</span>
                  <span>{{ yubikeyLoading ? 'Menunggu PIN & Sentuhan YubiKey...' : 'Sentuh YubiKey & Masukkan PIN' }}</span>
                </button>
              </div>
            </template>
          </template>

          <!-- ─── SUB-VIEW 2: SELF-REGISTRATION FORM ─── -->
          <template v-else>
            <!-- Check if registration is allowed -->
            <div v-if="!publicSettings.allowPublicRegistration" class="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
              <span class="text-3xl">🔒</span>
              <h3 class="text-sm font-bold text-amber-300">Pendaftaran Publik Ditutup</h3>
              <p class="text-xs text-slate-400 leading-relaxed">
                Administrator AuthHub saat ini menonaktifkan pendaftaran mandiri. Silakan hubungi admin sistem untuk mendapatkan akses akun.
              </p>
              <button
                @click="authPortalTab = 'login'"
                class="mt-3 px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
              >
                Kembali ke Halaman Login
              </button>
            </div>

            <div v-else class="space-y-4">
              <!-- Notice if approval is required -->
              <div v-if="publicSettings.requireAdminApproval" class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300 flex items-start gap-2">
                <span class="text-base shrink-0">ℹ️</span>
                <span class="leading-relaxed">Kebijakan Keamanan: Pendaftaran akun baru memerlukan persetujuan Administrator sebelum dapat login.</span>
              </div>

              <!-- Error Alert -->
              <div v-if="regError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
                <span class="text-base shrink-0">⚠️</span>
                <p class="leading-relaxed">{{ regError }}</p>
              </div>

              <!-- Success Alert -->
              <div v-if="regSuccessMessage" class="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
                <span class="text-base shrink-0">✅</span>
                <p class="leading-relaxed">{{ regSuccessMessage }}</p>
              </div>

              <!-- Registration Form -->
              <form @submit.prevent="handleRegister" class="space-y-3">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-300">Nama Lengkap</label>
                  <input
                    v-model="regForm.name"
                    type="text"
                    required
                    placeholder="Contoh: Pratama Dev"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-300">Email</label>
                    <input
                      v-model="regForm.email"
                      type="email"
                      required
                      placeholder="dev@example.com"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-300">Username SSO</label>
                    <input
                      v-model="regForm.username"
                      type="text"
                      required
                      placeholder="pratamadev"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-300">Password</label>
                    <input
                      v-model="regForm.password"
                      type="password"
                      required
                      placeholder="Min. 6 karakter"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-300">Konfirmasi Password</label>
                    <input
                      v-model="regForm.confirmPassword"
                      type="password"
                      required
                      placeholder="Ulangi password"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  :disabled="regLoading"
                  class="w-full py-3 px-4 mt-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span v-if="regLoading" class="animate-spin text-base">⏳</span>
                  <span v-else>✨</span>
                  <span>{{ regLoading ? 'Mendaftarkan Akun...' : 'Daftar Akun Sekarang' }}</span>
                </button>
              </form>

              <div class="pt-2 border-t border-slate-800 text-center">
                <button
                  @click="authPortalTab = 'login'"
                  class="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Sudah memiliki akun? <span class="text-indigo-400 font-bold underline">Masuk di sini</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>

    <!-- Modal: YubiKey & Hardware Keys Management -->
    <div
      v-if="showWebAuthnModal"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="glass-card rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 border border-violet-500/40 bg-[#0d1322]/95 shadow-2xl relative">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-xl">
              🛡️
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Kelola Hardware Key (YubiKey + PIN)</h3>
              <p class="text-xs text-slate-400">FIDO2 / WebAuthn Hardware Token dengan Proteksi PIN</p>
            </div>
          </div>
          <button @click="showWebAuthnModal = false" class="text-slate-400 hover:text-white text-lg cursor-pointer">&times;</button>
        </div>

        <div class="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-slate-300 space-y-1">
          <p class="font-bold text-indigo-300">💡 Standar Keamanan FIDO2 User Verification:</p>
          <p class="leading-relaxed">
            Setiap kunci YubiKey diproteksi dengan <strong>Hardware PIN</strong> mandiri. Saat pendaftaran maupun login, Anda akan diminta memasukkan PIN pada dialog browser lalu menyentuh fisik YubiKey.
          </p>
        </div>

        <!-- Registered Keys List -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Daftar Kunci Terdaftar:</span>
            <span class="text-violet-400 font-mono">{{ myWebAuthnKeys.length }} Terpasang</span>
          </div>

          <div v-if="myWebAuthnKeys.length === 0" class="p-6 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-400 space-y-1">
            <p>Belum ada YubiKey yang didaftarkan pada akun ini.</p>
            <p class="text-[11px] text-slate-500">Daftarkan YubiKey Anda di bawah untuk mengaktifkan login cepat &amp; aman.</p>
          </div>

          <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div
              v-for="k in myWebAuthnKeys"
              :key="k.id"
              class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div class="space-y-0.5 truncate">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-white truncate">{{ k.name }}</span>
                  <span class="px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 font-mono text-[9px]">PIN OK</span>
                </div>
                <div class="text-[10px] text-slate-400 font-mono truncate">
                  Counter: {{ k.counter }} &bull; Terdaftar: {{ new Date(k.createdAt).toLocaleDateString() }}
                </div>
              </div>
              <button
                @click="deleteWebAuthnKey(k.id)"
                class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold shrink-0 cursor-pointer"
                title="Hapus Kunci Ini"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>

        <!-- Add New Key Form -->
        <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-300">Nama Perangkat YubiKey</label>
            <input
              v-model="newKeyLabel"
              type="text"
              placeholder="Contoh: YubiKey 5 NFC (Utama)"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <!-- Error Alert -->
          <div v-if="keyRegisterError" class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
            {{ keyRegisterError }}
          </div>

          <button
            type="button"
            @click="registerNewYubiKey"
            :disabled="registeringKey"
            class="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span v-if="registeringKey" class="animate-spin text-sm">⏳</span>
            <span v-else>+</span>
            <span>{{ registeringKey ? 'Menunggu PIN & Sentuhan YubiKey...' : 'Daftarkan YubiKey Ini (PIN + Touch)' }}</span>
          </button>
        </div>

        <div class="flex justify-end pt-1">
          <button
            @click="showWebAuthnModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Add New Project / OAuth Client -->
    <div
      v-if="showAddClientModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="glass-card rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-700">
        <h3 class="text-base font-bold text-white">Tambah Project Ekosistem Baru</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Nama Aplikasi</label>
            <input v-model="newClient.name" type="text" placeholder="Contoh: Billing Portal" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-2">
              <label class="block text-slate-400 mb-1">Slug ID</label>
              <input v-model="newClient.slug" type="text" placeholder="billing-portal" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Ikon</label>
              <input v-model="newClient.icon" type="text" placeholder="💳" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-center" />
            </div>
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Tech Stack</label>
            <input v-model="newClient.techStack" type="text" placeholder="Next.js + Express" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Redirect Callback URI</label>
            <input v-model="newClient.redirectUri" type="text" placeholder="http://localhost:3005/auth/callback" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono" />
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Deskripsi</label>
            <input v-model="newClient.description" type="text" placeholder="Deskripsi singkat project" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button @click="showAddClientModal = false" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer">Batal</button>
          <button @click="createClient" class="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white cursor-pointer">Simpan Project</button>
        </div>
      </div>
    </div>

    <!-- Modal: Add New User -->
    <div
      v-if="showAddUserModal"
      class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div class="glass-card rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-700">
        <h3 class="text-base font-bold text-white">Tambah Akun Pengguna SSO</h3>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Nama Lengkap</label>
            <input v-model="newUser.name" type="text" placeholder="Budi Santoso" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">Email</label>
              <input v-model="newUser.email" type="email" placeholder="budi@minihost.local" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Username</label>
              <input v-model="newUser.username" type="text" placeholder="budi" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">Password</label>
              <input v-model="newUser.password" type="password" placeholder="Minimal 6 karakter" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Global Role</label>
              <select v-model="newUser.globalRole" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button @click="showAddUserModal = false" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer">Batal</button>
          <button @click="createUser" class="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white cursor-pointer">Buat Akun</button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xl border border-indigo-400/30 animate-bounce"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";

// ─── Main Tabs Navigation ──────────────────────────────────────
const activeTab = ref<"simulator" | "matrix" | "clients" | "sessions" | "settings" | "sdk">("simulator");

const tabs = [
  { id: "simulator", label: "Simulasi SSO", icon: "🧪" },
  { id: "matrix", label: "Pengguna & RBAC", icon: "👥" },
  { id: "clients", label: "Daftar Project", icon: "🏢" },
  { id: "sessions", label: "Sesi & Audit", icon: "🛡️" },
  { id: "settings", label: "Kebijakan SSO", icon: "⚙️" },
  { id: "sdk", label: "Integrasi SDK", icon: "🔌" },
] as const;

const stats = ref({
  totalClients: 9,
  totalUsers: 1,
  activeSessions: 0,
  totalAuditEvents: 0,
});

const clients = ref<any[]>([]);
const users = ref<any[]>([]);
const sessions = ref<any[]>([]);
const auditLogs = ref<any[]>([]);
const toastMessage = ref("");

// ─── Settings State ─────────────────────────────────────────────
const settings = ref({
  allowPublicRegistration: true,
  requireAdminApproval: false,
  defaultMemberRole: "member",
  publicClientSlugs: ["guidepath", "learnify", "resumecraft"],
});
const savingSettings = ref(false);

// ─── Public Portal State (Login vs Register) ────────────────────
const authPortalTab = ref<"login" | "register">("login");
const loginMode = ref<"password" | "yubikey">("password");
const oauthClientInfo = ref<{
  clientId?: string;
  slug?: string;
  name?: string;
  icon?: string;
  redirectUri?: string;
  state?: string;
} | null>(null);

function checkOauthParams() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client_id") || params.get("client_slug");
  if (clientId) {
    const isGuide = clientId === "guidepath" || clientId.includes("guidepath");
    oauthClientInfo.value = {
      clientId,
      slug: params.get("client_slug") || (isGuide ? "guidepath" : clientId),
      name: params.get("client_name") || (isGuide ? "GuidePath Thesis & AI Research" : clientId),
      icon: params.get("client_icon") || (isGuide ? "🎓" : "⚡"),
      redirectUri: params.get("redirect_uri") || undefined,
      state: params.get("state") || "sso",
    };
  }
}
const publicSettings = ref({
  allowPublicRegistration: true,
  requireAdminApproval: false,
  appName: "AuthHub SSO",
});

const regForm = ref({
  name: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
});
const regLoading = ref(false);
const regError = ref("");
const regSuccessMessage = ref("");

// ─── Admin Authentication State ────────────────────────────────
const isLoggedIn = ref(false);
const currentAdmin = ref<{
  id: string;
  email: string;
  username: string;
  name: string;
  globalRole: string;
} | null>(null);

const loginForm = ref({
  identifier: "josapratama@minihost.local",
  password: "admin123",
  totpCode: "",
});
const loginLoading = ref(false);
const loginError = ref("");
const loginRequire2fa = ref(false);
const loginDemoTotp = ref("");

// ─── WebAuthn / YubiKey State ──────────────────────────────────
const yubikeyIdentifier = ref("josapratama@minihost.local");
const yubikeyLoading = ref(false);
const yubikeyError = ref("");

const showWebAuthnModal = ref(false);
const myWebAuthnKeys = ref<any[]>([]);
const newKeyLabel = ref("YubiKey 5 NFC (Hardware Token)");
const registeringKey = ref(false);
const keyRegisterError = ref("");

// ─── Search Queries ─────────────────────────────────────────────
const userSearchQuery = ref("");
const clientSearchQuery = ref("");
const visibleSecrets = ref<Record<string, boolean>>({});

const filteredUsers = computed(() => {
  const q = userSearchQuery.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.globalRole.toLowerCase().includes(q)
  );
});

const filteredClients = computed(() => {
  const q = clientSearchQuery.value.trim().toLowerCase();
  if (!q) return clients.value;
  return clients.value.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.techStack && c.techStack.toLowerCase().includes(q))
  );
});

function toggleSecretVisibility(clientId: string) {
  visibleSecrets.value[clientId] = !visibleSecrets.value[clientId];
}

function getAdminToken(): string | null {
  return localStorage.getItem("authhub_admin_token");
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !url.includes("/api/admin/login") && !url.includes("/api/webauthn/login")) {
    localStorage.removeItem("authhub_admin_token");
    localStorage.removeItem("authhub_admin_user");
    currentAdmin.value = null;
    isLoggedIn.value = false;
  }
  return res;
}

async function fetchPublicSettings() {
  try {
    const res = await fetch("/api/public-settings");
    if (res.ok) {
      publicSettings.value = await res.json();
    }
  } catch (e) {
    console.error("Failed to load public settings", e);
  }
}

async function handleRegister() {
  regError.value = "";
  regSuccessMessage.value = "";

  if (!regForm.value.name || !regForm.value.email || !regForm.value.username || !regForm.value.password) {
    regError.value = "Semua kolom wajib diisi.";
    return;
  }
  if (regForm.value.password.length < 6) {
    regError.value = "Password minimal harus 6 karakter.";
    return;
  }
  if (regForm.value.password !== regForm.value.confirmPassword) {
    regError.value = "Konfirmasi password tidak cocok.";
    return;
  }

  regLoading.value = true;
  try {
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: regForm.value.name,
        email: regForm.value.email,
        username: regForm.value.username,
        password: regForm.value.password,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      regError.value = data.error || "Pendaftaran gagal.";
      return;
    }

    regSuccessMessage.value = data.message || "Pendaftaran akun berhasil!";
    regForm.value = { name: "", email: "", username: "", password: "", confirmPassword: "" };

    if (!data.requireApproval) {
      showToast("Pendaftaran sukses! Silakan masuk dengan akun baru.");
      setTimeout(() => {
        authPortalTab.value = "login";
      }, 1500);
    }
  } catch (err: any) {
    regError.value = err.message || "Gagal menghubungi server.";
  } finally {
    regLoading.value = false;
  }
}

async function handleAdminLogin() {
  loginLoading.value = true;
  loginError.value = "";
  loginDemoTotp.value = "";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm.value),
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.value = data.error || data.message || "Login gagal";
      if (data.require2FA) {
        loginRequire2fa.value = true;
        loginDemoTotp.value = data.demoHint || "";
      }
      return;
    }

    localStorage.setItem("authhub_admin_token", data.token);
    localStorage.setItem("authhub_admin_user", JSON.stringify(data.user));
    currentAdmin.value = data.user;
    isLoggedIn.value = true;
    showToast(`Selamat datang kembali, ${data.user.name}!`);

    // If redirected by an OAuth client (e.g. GuidePath), authorize and redirect back!
    if (oauthClientInfo.value) {
      try {
        const authRes = await fetch("/api/v1/auth/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: loginForm.value.identifier,
            password: loginForm.value.password,
            totpCode: loginForm.value.totpCode,
            clientId: oauthClientInfo.value.clientId || oauthClientInfo.value.slug,
            redirectUri: oauthClientInfo.value.redirectUri,
          }),
        });
        const authData = await authRes.json();
        if (authData.redirectUri) {
          showToast(`✅ Autentikasi SSO sukses! Mengalihkan ke ${oauthClientInfo.value.name}...`);
          setTimeout(() => {
            window.location.href = authData.redirectUri;
          }, 600);
          return;
        }
      } catch (oauthErr) {
        console.error("SSO redirect error", oauthErr);
      }
    }

    await fetchOverview();
    await fetchSdkSnippets();
    await fetchMyWebAuthnKeys();
  } catch (err: any) {
    loginError.value = err.message || "Gagal menghubungi server";
  } finally {
    loginLoading.value = false;
  }
}

async function handleYubikeyLogin() {
  yubikeyLoading.value = true;
  yubikeyError.value = "";

  if (!browserSupportsWebAuthn()) {
    yubikeyError.value = "Browser ini tidak mendukung WebAuthn / FIDO2 security key.";
    yubikeyLoading.value = false;
    return;
  }

  try {
    // 1. Get authentication options from backend
    const res = await fetch("/api/webauthn/login/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: yubikeyIdentifier.value.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      yubikeyError.value = data.error || "Gagal memulai otentikasi YubiKey.";
      return;
    }

    // 2. Invoke native WebAuthn ceremony (prompts for User PIN & touch)
    const asseResp = await startAuthentication(data.options);

    // 3. Verify assertion on backend (pass OAuth client context if present)
    const verifyRes = await fetch("/api/webauthn/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeSessionId: data.challengeSessionId,
        response: asseResp,
        clientSlug: oauthClientInfo.value?.slug,
        clientId: oauthClientInfo.value?.clientId,
        redirectUri: oauthClientInfo.value?.redirectUri,
        state: oauthClientInfo.value?.state,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      yubikeyError.value = verifyData.error || "Verifikasi YubiKey ditolak.";
      return;
    }

    // 4. Success!
    localStorage.setItem("authhub_admin_token", verifyData.token);
    localStorage.setItem("authhub_admin_user", JSON.stringify(verifyData.user));
    currentAdmin.value = verifyData.user;
    isLoggedIn.value = true;
    showToast(verifyData.message || "✅ Login dengan YubiKey (PIN Terverifikasi) Berhasil!");

    if (verifyData.redirectUri) {
      showToast(`✅ YubiKey Terverifikasi! Mengalihkan ke ${oauthClientInfo.value?.name || 'aplikasi'}...`);
      setTimeout(() => {
        window.location.href = verifyData.redirectUri;
      }, 600);
      return;
    }

    await fetchOverview();
    await fetchSdkSnippets();
    await fetchMyWebAuthnKeys();
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      yubikeyError.value = "Autentikasi dibatalkan atau PIN salah.";
    } else {
      yubikeyError.value = err.message || "Gagal melakukan verifikasi YubiKey.";
    }
  } finally {
    yubikeyLoading.value = false;
  }
}

async function fetchMyWebAuthnKeys() {
  try {
    const res = await apiFetch("/api/webauthn/keys");
    if (res.ok) {
      const data = await res.json();
      myWebAuthnKeys.value = data.keys || [];
    }
  } catch (e) {
    console.error("Failed to load webauthn keys", e);
  }
}

async function registerNewYubiKey() {
  registeringKey.value = true;
  keyRegisterError.value = "";

  if (!browserSupportsWebAuthn()) {
    keyRegisterError.value = "Browser Anda tidak mendukung WebAuthn / FIDO2.";
    registeringKey.value = false;
    return;
  }

  try {
    // 1. Get registration options
    const res = await apiFetch("/api/webauthn/register/options", { method: "POST" });
    const options = await res.json();
    if (!res.ok) {
      keyRegisterError.value = options.error || "Gagal mendapatkan opsi registrasi.";
      return;
    }

    // 2. Invoke browser native WebAuthn ceremony (prompts user to enter YubiKey PIN + Touch)
    const attResp = await startRegistration(options);

    // 3. Send response to backend
    const verifyRes = await apiFetch("/api/webauthn/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: attResp,
        keyName: newKeyLabel.value.trim() || "YubiKey Security Key (PIN)",
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) {
      keyRegisterError.value = verifyData.error || "Verifikasi registrasi YubiKey gagal.";
      return;
    }

    showToast(verifyData.message || "✅ YubiKey berhasil didaftarkan dengan User PIN!");
    newKeyLabel.value = "YubiKey 5 NFC (Hardware Token)";
    await fetchMyWebAuthnKeys();
    await fetchOverview();
  } catch (err: any) {
    if (err.name === "NotAllowedError") {
      keyRegisterError.value = "Pendaftaran dibatalkan atau waktu habis.";
    } else {
      keyRegisterError.value = err.message || "Gagal mendaftarkan YubiKey.";
    }
  } finally {
    registeringKey.value = false;
  }
}

async function deleteWebAuthnKey(keyId: string) {
  if (!confirm("Apakah Anda yakin ingin menghapus kunci keamanan YubiKey ini?")) return;
  try {
    const res = await apiFetch(`/api/webauthn/keys/${keyId}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Kunci YubiKey berhasil dihapus.");
      await fetchMyWebAuthnKeys();
      await fetchOverview();
    }
  } catch (e: any) {
    showToast("Gagal menghapus kunci: " + e.message);
  }
}

function openWebAuthnModal() {
  showWebAuthnModal.value = true;
  fetchMyWebAuthnKeys();
}

async function handleAdminLogout() {
  try {
    await apiFetch("/api/admin/logout", { method: "POST" });
  } catch (e) {}
  localStorage.removeItem("authhub_admin_token");
  localStorage.removeItem("authhub_admin_user");
  currentAdmin.value = null;
  isLoggedIn.value = false;
  showToast("Anda telah keluar dari AuthHub");
  await fetchPublicSettings();
}

function fillDemoRootAdmin() {
  loginForm.value.identifier = "josapratama@minihost.local";
  loginForm.value.password = "admin123";
  loginError.value = "";
}

// ─── Simulator State ─────────────────────────────────────────────
const simForm = ref({
  clientSlug: "minihost",
  identifier: "josapratama@minihost.local",
  password: "admin123",
  totpCode: "",
});
const simLoading = ref(false);
const simError = ref("");
const simDemoTotp = ref("");
const simResult = ref<any>(null);
const verifyCheckOutput = ref<any>(null);

const selectedSimClient = computed(() =>
  clients.value.find((c) => c.slug === simForm.value.clientSlug) || clients.value[0]
);

function selectUserForSimulation(u: any) {
  simForm.value.identifier = u.email;
  if (u.id === "usr_josa_root") {
    simForm.value.password = "admin123";
  } else {
    simForm.value.password = "";
  }
  simError.value = "";
  simDemoTotp.value = "";
}

// ─── SDK State ───────────────────────────────────────────────────
const selectedSdkClient = ref("minihost");
const sdkSnippets = ref<{ express: string; fastapi: string; frontend: string } | null>(null);

// ─── Modals ──────────────────────────────────────────────────────
const showAddClientModal = ref(false);
const showAddUserModal = ref(false);

const newClient = ref({
  name: "",
  slug: "",
  icon: "🚀",
  techStack: "Fullstack App",
  redirectUri: "http://localhost:3000/auth/callback",
  description: "",
});

const newUser = ref({
  name: "",
  email: "",
  username: "",
  password: "",
  globalRole: "member",
});

function showToast(msg: string) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = "";
  }, 3200);
}

async function fetchOverview() {
  try {
    const res = await apiFetch("/api/overview");
    if (!res.ok) return;
    const data = await res.json();
    stats.value = data.stats;
    clients.value = data.clients;
    users.value = data.users;
    sessions.value = data.sessions;
    auditLogs.value = data.auditLogs;
    if (data.settings) {
      settings.value = data.settings;
    }
  } catch (e) {
    console.error("Failed to load overview", e);
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    const res = await apiFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings.value),
    });
    if (res.ok) {
      const data = await res.json();
      settings.value = data.settings;
      await fetchPublicSettings();
      showToast("Kebijakan SSO berhasil disimpan!");
    } else {
      showToast("Gagal menyimpan pengaturan.");
    }
  } catch (e: any) {
    showToast("Error: " + e.message);
  } finally {
    savingSettings.value = false;
  }
}

async function toggleUserStatus(userId: string) {
  try {
    const res = await apiFetch(`/api/users/${userId}/toggle-status`, { method: "PUT" });
    if (res.ok) {
      const data = await res.json();
      await fetchOverview();
      showToast(data.message || "Status pengguna diperbarui.");
    }
  } catch (e: any) {
    showToast("Gagal mengubah status: " + e.message);
  }
}

async function runSsoSimulation() {
  simLoading.value = true;
  simError.value = "";
  simDemoTotp.value = "";
  verifyCheckOutput.value = null;

  try {
    const res = await apiFetch("/api/v1/auth/simulate-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simForm.value),
    });
    const data = await res.json();
    if (!res.ok) {
      simError.value = data.error || "Login gagal";
      if (data.demoTotpCode) {
        simDemoTotp.value = data.demoTotpCode;
      }
      simResult.value = null;
    } else {
      simResult.value = data;
      showToast(`✅ Handshake SSO ke ${selectedSimClient.value?.name} berhasil!`);
    }
    await fetchOverview();
  } catch (e: any) {
    simError.value = e.message;
  } finally {
    simLoading.value = false;
  }
}

async function verifySimulatedToken() {
  if (!simResult.value?.accessToken) return;
  const res = await fetch("/api/v1/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: simResult.value.accessToken,
      clientSlug: simForm.value.clientSlug,
    }),
  });
  verifyCheckOutput.value = await res.json();
}

async function revokeSimulatedSession() {
  const sid = simResult.value?.session?.id;
  if (!sid) return;
  await apiFetch(`/api/sessions/${sid}/revoke`, { method: "POST" });
  await verifySimulatedToken();
  await fetchOverview();
  showToast("🛑 Sesi dicabut! Token JWT sekarang otomatis ditolak.");
}

async function onRoleChange(userId: string, clientSlug: string, role: string) {
  await apiFetch(`/api/users/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientSlug, role }),
  });
  await fetchOverview();
  showToast(`Role untuk ${clientSlug} diperbarui ke ${role.toUpperCase()}`);
}

async function toggle2FA(userId: string) {
  await apiFetch(`/api/users/${userId}/toggle-2fa`, { method: "POST" });
  await fetchOverview();
  showToast("Status 2FA TOTP pengguna diperbarui");
}

async function revokeAllForUser(userId: string) {
  await apiFetch(`/api/users/${userId}/revoke-all`, { method: "POST" });
  await fetchOverview();
  showToast("Seluruh sesi pengguna berhasil dihentikan (Global Force Logout)");
}

async function deleteUser(userId: string) {
  await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
  await fetchOverview();
  showToast("Akun pengguna dihapus");
}

async function createClient() {
  if (!newClient.value.name || !newClient.value.slug) return;
  const res = await apiFetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...newClient.value,
      redirectUris: [newClient.value.redirectUri],
    }),
  });
  if (res.ok) {
    showAddClientModal.value = false;
    newClient.value = {
      name: "",
      slug: "",
      icon: "🚀",
      techStack: "Fullstack App",
      redirectUri: "http://localhost:3000/auth/callback",
      description: "",
    };
    await fetchOverview();
    showToast("Project baru berhasil didaftarkan ke AuthHub!");
  }
}

async function rotateSecret(clientId: string) {
  await apiFetch(`/api/clients/${clientId}/rotate-secret`, { method: "POST" });
  await fetchOverview();
  showToast("Client Secret berhasil diputar ulang (Rotated)");
}

async function deleteClient(clientId: string) {
  await apiFetch(`/api/clients/${clientId}`, { method: "DELETE" });
  await fetchOverview();
  showToast("Aplikasi dihapus");
}

async function createUser() {
  if (!newUser.value.email || !newUser.value.username || !newUser.value.password) return;
  const res = await apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newUser.value),
  });
  if (res.ok) {
    showAddUserModal.value = false;
    newUser.value = { name: "", email: "", username: "", password: "", globalRole: "member" };
    await fetchOverview();
    showToast("Akun SSO baru berhasil dibuat!");
  }
}

async function revokeSessionById(sid: string) {
  await apiFetch(`/api/sessions/${sid}/revoke`, { method: "POST" });
  await fetchOverview();
  showToast("Sesi JWT berhasil dicabut");
}

async function fetchSdkSnippets() {
  const res = await apiFetch(`/api/v1/sdk/${selectedSdkClient.value}`);
  if (res.ok) {
    const data = await res.json();
    sdkSnippets.value = data.snippets;
  }
}

function openSdkForClient(slug: string) {
  selectedSdkClient.value = slug;
  activeTab.value = "sdk";
  fetchSdkSnippets();
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  showToast("Disalin ke clipboard!");
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "superadmin":
      return "bg-indigo-500/20 border-indigo-500/40 text-indigo-300";
    case "admin":
      return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
    case "editor":
      return "bg-amber-500/20 border-amber-500/40 text-amber-300";
    case "viewer":
      return "bg-sky-500/20 border-sky-500/40 text-sky-300";
    default:
      return "bg-rose-500/15 border-rose-500/30 text-rose-400";
  }
}

onMounted(async () => {
  checkOauthParams();
  await fetchPublicSettings();
  const token = getAdminToken();
  if (token) {
    try {
      const res = await apiFetch("/api/admin/me");
      if (res.ok) {
        const data = await res.json();
        currentAdmin.value = data.user;
        isLoggedIn.value = true;
        await fetchOverview();
        await fetchSdkSnippets();
        await fetchMyWebAuthnKeys();
        return;
      }
    } catch (e) {
      console.error("Auth check failed", e);
    }
  }
  isLoggedIn.value = false;
});
</script>
