<template>
  <div class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
    <!-- Ambient Background Glow -->
    <div class="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none"></div>
    <div class="fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none"></div>

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/85 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-extrabold tracking-tight text-white">Auth<span class="text-indigo-400">Hub</span></h1>
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SSO &bull; OAuth2 &bull; RBAC
            </span>
          </div>
          <p class="text-[11px] text-slate-400">Pusat Identitas &amp; Single Sign-On Seluruh Project Ekosistem</p>
        </div>
      </div>

      <!-- Right Actions -->
      <div v-if="isLoggedIn" class="flex items-center gap-2 sm:gap-3">
        <button
          @click="activeTab = 'simulator'"
          class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-300 transition-colors cursor-pointer"
        >
          <span>🧪</span>
          <span>Coba Simulasi SSO</span>
        </button>

        <button
          @click="showAddUserModal = true"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
        >
          <span>+ User Baru</span>
        </button>

        <button
          @click="showAddClientModal = true"
          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
        >
          <span>+ Tambah Project</span>
        </button>

        <!-- Admin Profile Pill & Logout Button -->
        <div class="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div class="hidden md:flex flex-col text-right">
            <span class="text-xs font-bold text-white">{{ currentAdmin?.name || 'Root Admin' }}</span>
            <span class="text-[10px] text-indigo-400 font-mono uppercase">{{ currentAdmin?.globalRole || 'superadmin' }}</span>
          </div>
          <button
            @click="handleAdminLogout"
            class="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Keluar dari sesi Admin"
          >
            <span>🚪</span>
            <span class="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      <div v-else class="flex items-center gap-2">
        <span class="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Admin Portal Terproteksi</span>
        </span>
      </div>
    </header>

    <!-- Main Container (Authenticated Dashboard) -->
    <main v-if="isLoggedIn" class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <!-- KPI Summary Bar -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Terhubung (OAuth Apps)</p>
            <p class="text-2xl font-extrabold text-white mt-1">{{ stats.totalClients }} <span class="text-xs font-normal text-indigo-400">Project</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-lg">🏢</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Akun Terpusat (SSO)</p>
            <p class="text-2xl font-extrabold text-white mt-1">{{ stats.totalUsers }} <span class="text-xs font-normal text-violet-400">Pengguna</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-lg">👥</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sesi JWT Aktif</p>
            <p class="text-2xl font-extrabold text-emerald-400 mt-1">{{ stats.activeSessions }} <span class="text-xs font-normal text-slate-400">Token</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg">🔑</div>
        </div>

        <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Log Audit Keamanan</p>
            <p class="text-2xl font-extrabold text-amber-400 mt-1">{{ stats.totalAuditEvents }} <span class="text-xs font-normal text-slate-400">Event</span></p>
          </div>
          <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg">🛡️</div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 border-b-2"
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
              <h2 class="text-lg font-bold text-white">Satu Pintu Login untuk Mini VPS Panel &amp; Seluruh Project Anda</h2>
              <p class="text-xs text-slate-300 leading-relaxed max-w-3xl">
                Pilih salah satu aplikasi di bawah, pilih akun percobaan, lalu klik <strong>"Simulasikan Login SSO"</strong>. Anda akan melihat bagaimana <strong>AuthHub</strong> memvalidasi izin aplikasi (RBAC), menerbitkan <code>authorization_code</code>, menukarnya menjadi <code>JWT Token</code>, hingga cara memutus sesi secara terpusat (<em>Global Kill-Switch</em>).
              </p>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center shrink-0 text-[11px]">
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
                <div class="text-[10px] text-slate-400">Ke HS256 JWT</div>
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
          <div class="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-700/80 space-y-5 relative overflow-hidden">
            <div class="flex items-center justify-between border-b border-slate-800 pb-4">
              <div class="flex items-center gap-2.5">
                <span class="text-2xl">{{ selectedSimClient?.icon || '⚡' }}</span>
                <div>
                  <span class="text-[10px] uppercase tracking-wider font-bold text-indigo-400">Target Aplikasi (Client)</span>
                  <h3 class="text-base font-bold text-white">{{ selectedSimClient?.name }}</h3>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-slate-300">
                {{ selectedSimClient?.slug }}
              </span>
            </div>

            <!-- 1. Select Target App -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">1. Pilih Aplikasi yang Ingin Diakses:</label>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="c in clients"
                  :key="c.id"
                  @click="simForm.clientSlug = c.slug"
                  class="px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-1.5 truncate"
                  :class="
                    simForm.clientSlug === c.slug
                      ? 'bg-indigo-600/25 border-indigo-500 text-white font-bold'
                      : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'
                  "
                >
                  <span>{{ c.icon }}</span>
                  <span class="text-[11px] truncate">{{ c.name }}</span>
                </button>
              </div>
            </div>

            <!-- 2. Quick Account Presets -->
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1.5">2. Pilih Akun Uji Coba (1-Klik Isi Otomatis):</label>
              <div class="grid grid-cols-1 gap-1.5">
                <button
                  @click="fillSimUser('josapratama@minihost.local', 'admin123')"
                  class="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span class="font-bold text-white">Josa Pratama</span>
                    <span class="text-slate-400">(josapratama@minihost.local)</span>
                  </div>
                  <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">SUPERADMIN</span>
                </button>

                <button
                  @click="fillSimUser('developer@minihost.local', 'dev123')"
                  class="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span class="font-bold text-white">Tim Developer</span>
                    <span class="text-slate-400">(developer@minihost.local)</span>
                  </div>
                  <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">EDITOR / VIEWER</span>
                </button>

                <button
                  @click="fillSimUser('client@minihost.local', 'client123')"
                  class="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 flex items-center justify-between text-xs transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span class="font-bold text-white">Partner Eksternal</span>
                    <span class="text-slate-400">(Diblokir di Mini VPS, Admin di Irma)</span>
                  </div>
                  <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">UJI BLOKIR RBAC</span>
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

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-semibold text-slate-400 mb-1">Password</label>
                  <input
                    v-model="simForm.password"
                    type="password"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-semibold text-slate-400 mb-1">Kode 2FA TOTP (Opsional)</label>
                  <input
                    v-model="simForm.totpCode"
                    type="text"
                    maxlength="6"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
                    placeholder="6 digit jika 2FA aktif"
                  />
                </div>
              </div>
            </div>

            <!-- Error Banner if RBAC / Password Fails -->
            <div
              v-if="simError"
              class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-1"
            >
              <div class="font-bold text-rose-400 flex items-center gap-1.5">
                <span>⛔</span>
                <span>Autentikasi / Otorisasi Ditolak oleh AuthHub</span>
              </div>
              <p>{{ simError }}</p>
              <p v-if="simDemoTotp" class="text-emerald-300 font-mono mt-1">
                💡 Kode TOTP saat ini untuk akun tersebut: <strong>{{ simDemoTotp }}</strong>
              </p>
            </div>

            <!-- Submit Button -->
            <button
              @click="runSsoSimulation"
              :disabled="simLoading"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
            >
              <span>🔐</span>
              <span>{{ simLoading ? 'Memproses Handshake OAuth2...' : `Login ke ${selectedSimClient?.name || 'Aplikasi'} via AuthHub` }}</span>
            </button>
          </div>

          <!-- Right Column: Live 4-Step Handshake & Token Inspector -->
          <div class="lg:col-span-7 space-y-4">
            <div v-if="!simResult" class="glass-card rounded-2xl p-10 text-center space-y-3 border border-dashed border-slate-700">
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
                      <span class="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold flex items-center justify-center">
                        ✓
                      </span>
                      <h4 class="text-xs sm:text-sm font-bold text-white">{{ s.title }}</h4>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 font-mono text-[11px]">
                      {{ s.protocol }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300">{{ s.description }}</p>
                  <pre class="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 text-[11px] font-mono text-emerald-300 overflow-x-auto">{{ JSON.stringify(s.payload, null, 2) }}</pre>
                </div>
              </div>

              <!-- Live Token Verification & Global Kill-Switch Test Box -->
              <div class="glass-card rounded-2xl p-5 border border-emerald-500/30 bg-emerald-950/10 space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 class="text-sm font-bold text-white flex items-center gap-2">
                      <span>🔬 Uji Validasi Token &amp; Global Logout (Kill-Switch)</span>
                    </h4>
                    <p class="text-xs text-slate-400">
                      Buktikan bahwa saat sesi dicabut di AuthHub, token JWT ini langsung ditolak oleh aplikasi!
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="verifySimulatedToken"
                      class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                    >
                      ✓ Cek Validitas Token
                    </button>
                    <button
                      @click="revokeSimulatedSession"
                      class="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition-colors"
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
                  <pre>{{ JSON.stringify(verifyCheckOutput, null, 2) }}</pre>
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
            <h2 class="text-base font-bold text-white">Matriks Hak Akses (RBAC) Lintas Project</h2>
            <p class="text-xs text-slate-400">
              Atur siapa yang menjadi <code>superadmin</code>, <code>admin</code>, <code>editor</code>, <code>viewer</code>, atau <code>none</code> (blokir akses) di masing-masing aplikasi. Perubahan berlaku instan!
            </p>
          </div>
          <button
            @click="showAddUserModal = true"
            class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold self-start"
          >
            + Tambah Akun Pengguna
          </button>
        </div>

        <div class="glass-card rounded-2xl overflow-hidden border border-slate-800">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-900/90 text-slate-300">
                  <th class="p-3.5 font-bold min-w-[210px] sticky left-0 bg-slate-900 z-10">Pengguna / Akun SSO</th>
                  <th class="p-3.5 font-bold text-center min-w-[120px]">Keamanan 2FA</th>
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
                  <th class="p-3.5 font-bold text-center border-l border-slate-800/70">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/70">
                <tr v-for="u in users" :key="u.id" class="hover:bg-slate-800/30 transition-colors">
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

                  <!-- 2FA TOTP Toggle -->
                  <td class="p-3.5 text-center">
                    <button
                      @click="toggle2FA(u.id)"
                      class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all"
                      :class="
                        u.twoFactorEnabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      "
                    >
                      {{ u.twoFactorEnabled ? '🔒 2FA Aktif' : '🔓 2FA Nonaktif' }}
                    </button>
                    <div v-if="u.twoFactorEnabled && u.currentTotpDemo" class="text-[10px] font-mono text-emerald-400 mt-1">
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
                      class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border focus:outline-none cursor-pointer w-full text-center"
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
                        class="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold"
                        title="Logout paksa dari semua aplikasi"
                      >
                        Force Logout
                      </button>
                      <button
                        v-if="u.id !== 'usr_josa_root'"
                        @click="deleteUser(u.id)"
                        class="px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[10px] font-bold"
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
      </section>

      <!-- ══════════════════════════════════════════════════════════════════ -->
      <!-- TAB 3: CONNECTED ECOSYSTEM APPS (OAUTH2 CLIENTS)                   -->
      <!-- ══════════════════════════════════════════════════════════════════ -->
      <section v-if="activeTab === 'clients'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold text-white">Daftar Project &amp; OAuth2 Clients ({{ clients.length }} Aplikasi)</h2>
            <p class="text-xs text-slate-400">Setiap aplikasi di folder <code>project/</code> memiliki <code>client_id</code> dan <code>client_secret</code> unik untuk memverifikasi login SSO.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="c in clients"
            :key="c.id"
            class="glass-card-hover rounded-2xl p-5 flex flex-col justify-between space-y-4"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-2xl">
                    {{ c.icon }}
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-white">{{ c.name }}</h3>
                    <span class="text-[11px] font-mono text-indigo-400">{{ c.slug }}</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-semibold">
                  {{ c.techStack }}
                </span>
              </div>

              <p class="text-xs text-slate-400 line-clamp-2">{{ c.description }}</p>

              <!-- Credentials Box -->
              <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2 text-[11px] font-mono">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-400">client_id:</span>
                  <button
                    @click="copyText(c.clientId)"
                    class="text-indigo-300 hover:underline truncate"
                    title="Klik untuk salin"
                  >
                    {{ c.clientId }}
                  </button>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-400">secret:</span>
                  <button
                    @click="copyText(c.clientSecret)"
                    class="text-emerald-300 hover:underline truncate max-w-[180px]"
                    title="Klik untuk salin Client Secret"
                  >
                    {{ c.clientSecret }}
                  </button>
                </div>
              </div>
            </div>

            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <button
                @click="openSdkForClient(c.slug)"
                class="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-bold transition-colors"
              >
                🔌 Kode Integrasi
              </button>
              <div class="flex items-center gap-1.5">
                <button
                  @click="rotateSecret(c.id)"
                  class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold"
                  title="Putar ulang Client Secret"
                >
                  🔄 Rotate
                </button>
                <button
                  v-if="c.slug !== 'minihost'"
                  @click="deleteClient(c.id)"
                  class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-[11px] font-semibold"
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
          <h2 class="text-base font-bold text-white">🔑 Sesi JWT Aktif (Global Session Control)</h2>
          <div class="glass-card rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
            <div v-if="sessions.length === 0" class="p-8 text-center text-xs text-slate-400">
              Belum ada sesi login. Coba jalankan login di tab <strong>Simulasi SSO</strong>!
            </div>
            <div
              v-for="s in sessions"
              :key="s.id"
              class="p-4 flex items-center justify-between gap-3"
            >
              <div class="space-y-1">
                <div class="flex items-center gap-2">
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
                <div class="text-[11px] font-mono text-slate-400">
                  {{ s.id }} &bull; IP: {{ s.ipAddress }}
                </div>
              </div>
              <button
                v-if="!s.revoked"
                @click="revokeSessionById(s.id)"
                class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold shrink-0"
              >
                Cabut Akses
              </button>
            </div>
          </div>
        </div>

        <!-- Security Audit Trail -->
        <div class="lg:col-span-6 space-y-3">
          <h2 class="text-base font-bold text-white">🛡️ Riwayat Audit Keamanan (Real-Time)</h2>
          <div class="glass-card rounded-2xl divide-y divide-slate-800/80 max-h-[540px] overflow-y-auto">
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
      <!-- TAB 5: PLUG & PLAY SDK CODE GENERATOR                              -->
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
            class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-indigo-300"
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
              <button @click="copyText(sdkSnippets.express)" class="text-xs text-indigo-300 hover:underline">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.express }}</pre>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-3 flex flex-col">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-sky-400">🐍 Python FastAPI (Mini VPS Panel)</span>
              <button @click="copyText(sdkSnippets.fastapi)" class="text-xs text-indigo-300 hover:underline">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.fastapi }}</pre>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-3 flex flex-col">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-violet-400">⚛️ Frontend (React / Vue / Next.js)</span>
              <button @click="copyText(sdkSnippets.frontend)" class="text-xs text-indigo-300 hover:underline">Salin Kode</button>
            </div>
            <pre class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto flex-1">{{ sdkSnippets.frontend }}</pre>
          </div>
        </div>
      </section>
    </main>

    <!-- Admin Login Screen (Shown when not authenticated) -->
    <main v-else class="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
      <div class="w-full max-w-md">
        <!-- Glowing Card -->
        <div class="glass-card rounded-3xl p-6 sm:p-8 border border-indigo-500/30 bg-[#0d1322]/90 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl relative overflow-hidden space-y-6">
          <div class="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>

          <!-- Logo & Header -->
          <div class="text-center space-y-2">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
              <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <h2 class="text-xl sm:text-2xl font-black tracking-tight text-white">AuthHub Admin Portal</h2>
            <p class="text-xs text-slate-400">Masuk untuk mengelola Identitas SSO, OAuth Clients, &amp; Matriks RBAC</p>
          </div>

          <!-- Error Alert Banner -->
          <div v-if="loginError" class="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
            <span class="text-base shrink-0">⚠️</span>
            <div class="space-y-1">
              <p class="font-bold">Gagal Masuk</p>
              <p class="leading-relaxed">{{ loginError }}</p>
            </div>
          </div>

          <!-- Form -->
          <form @submit.prevent="handleAdminLogin" class="space-y-4">
            <div class="space-y-1.5">
              <label class="text-xs font-bold text-slate-300">Email atau Username</label>
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
              <span>{{ loginLoading ? 'Memverifikasi...' : 'Masuk ke Dashboard' }}</span>
            </button>
          </form>

          <!-- Quick Fill Button for Developer/Admin Convenience -->
          <div class="pt-2 border-t border-slate-800 text-center">
            <button
              type="button"
              @click="fillDemoRootAdmin"
              class="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡</span>
              <span>Isi Otomatis Akun Root Superadmin (josapratama@minihost.local)</span>
            </button>
          </div>
        </div>
      </div>
    </main>

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
          <button @click="showAddClientModal = false" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300">Batal</button>
          <button @click="createClient" class="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white">Simpan Project</button>
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
          <button @click="showAddUserModal = false" class="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300">Batal</button>
          <button @click="createUser" class="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white">Buat Akun</button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div
      v-if="toastMessage"
      class="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xl"
    >
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const activeTab = ref<"simulator" | "matrix" | "clients" | "sessions" | "sdk">("simulator");

const tabs = [
  { id: "simulator", label: "Simulasi Cara Kerja SSO", icon: "🧪" },
  { id: "matrix", label: "Matriks Role & User (RBAC)", icon: "👥" },
  { id: "clients", label: "Daftar Aplikasi (9 Project)", icon: "🏢" },
  { id: "sessions", label: "Sesi Aktif & Audit Keamanan", icon: "🛡️" },
  { id: "sdk", label: "Kode Integrasi (SDK)", icon: "🔌" },
] as const;

const stats = ref({
  totalClients: 9,
  totalUsers: 3,
  activeSessions: 0,
  totalAuditEvents: 0,
});

const clients = ref<any[]>([]);
const users = ref<any[]>([]);
const sessions = ref<any[]>([]);
const auditLogs = ref<any[]>([]);
const toastMessage = ref("");

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
  if (res.status === 401 && !url.includes("/api/admin/login")) {
    localStorage.removeItem("authhub_admin_token");
    localStorage.removeItem("authhub_admin_user");
    currentAdmin.value = null;
    isLoggedIn.value = false;
  }
  return res;
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
    await fetchOverview();
    await fetchSdkSnippets();
  } catch (err: any) {
    loginError.value = err.message || "Gagal menghubungi server";
  } finally {
    loginLoading.value = false;
  }
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
}

function fillDemoRootAdmin() {
  loginForm.value.identifier = "josapratama@minihost.local";
  loginForm.value.password = "admin123";
  loginError.value = "";
}

// Simulator state
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

// SDK state
const selectedSdkClient = ref("minihost");
const sdkSnippets = ref<{ express: string; fastapi: string; frontend: string } | null>(null);

// Modals
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
  }, 3000);
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
  } catch (e) {
    console.error("Failed to load overview", e);
  }
}

function fillSimUser(email: string, pass: string) {
  simForm.value.identifier = email;
  simForm.value.password = pass;
  simError.value = "";
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
        return;
      }
    } catch (e) {
      console.error("Auth check failed", e);
    }
  }
  isLoggedIn.value = false;
});
</script>

