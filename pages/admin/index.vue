<script setup lang="ts">
definePageMeta({
  middleware: ["auth", "admin"],
});

interface ManagedQuiniela {
  id: string;
  name: string;
  description: string | null;
  access_code: string;
  start_date: string;
  end_date: string | null;
  champion_team: string | null;
  admin_id: string;
  admin_username: string;
  created_at: string;
}

interface GlobalStatsPayload {
  isGlobalAdmin: boolean;
  totals: {
    users: number;
    globalAdmins: number;
    quinielas: number;
    members: number;
    matches: number;
    predictions: number;
  };
  quinielas: ManagedQuiniela[];
}

const client = useSupabaseClient<any>();
const { quiniela, loadActiveQuiniela } = useActiveQuiniela();

const loadingLogs = ref(false);
const logsError = ref<string | null>(null);
const latestMatches = ref<
  {
    id: string;
    home_team: string;
    away_team: string;
    status: string;
    updated_at: string;
  }[]
>([]);
const syncingFixtures = ref(false);
const syncMessage = ref<string | null>(null);
const syncError = ref<string | null>(null);
const forceSync = ref(false);
const syncStatus = ref<{
  requestsUsedToday: number;
  dailyBudget: number;
  remainingToday: number;
  state: {
    lastSyncedAt: string | null;
    lastStatus: string;
    lastError: string | null;
    lastResponseCount: number;
  };
} | null>(null);

const globalLoading = ref(false);
const globalError = ref<string | null>(null);
const globalMessage = ref<string | null>(null);
const globalStats = ref<GlobalStatsPayload | null>(null);
const savingQuiniela = ref(false);
const deletingQuinielaId = ref<string | null>(null);

const quinielaForm = reactive({
  id: "",
  name: "",
  description: "",
  access_code: "",
  start_date: "",
  end_date: "",
  admin_id: "",
});

const isGlobalAdmin = computed(() => Boolean(globalStats.value?.isGlobalAdmin));
const managedQuinielas = computed(() => globalStats.value?.quinielas ?? []);

const toInputDateTime = (isoDate: string | null) => {
  if (!isoDate) {
    return "";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (inputValue: string) => {
  if (!inputValue) {
    return null;
  }

  const date = new Date(inputValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const randomAccessCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  quinielaForm.access_code = code;
};

const resetQuinielaForm = () => {
  quinielaForm.id = "";
  quinielaForm.name = "";
  quinielaForm.description = "";
  quinielaForm.access_code = "";
  quinielaForm.start_date = "";
  quinielaForm.end_date = "";
  quinielaForm.admin_id = "";
};

const editQuiniela = (item: ManagedQuiniela) => {
  quinielaForm.id = item.id;
  quinielaForm.name = item.name;
  quinielaForm.description = item.description ?? "";
  quinielaForm.access_code = item.access_code;
  quinielaForm.start_date = toInputDateTime(item.start_date);
  quinielaForm.end_date = toInputDateTime(item.end_date);
  quinielaForm.admin_id = item.admin_id;
  globalMessage.value = null;
  globalError.value = null;
};

const loadGlobalStats = async (silentIfForbidden = true) => {
  globalLoading.value = true;
  globalError.value = null;

  try {
    const data = await $fetch<GlobalStatsPayload>("/api/admin/global-stats");
    globalStats.value = data;
  } catch (error: any) {
    const statusCode = Number(error?.statusCode || error?.status || 0);

    if (silentIfForbidden && statusCode === 403) {
      globalStats.value = null;
    } else {
      globalError.value =
        error?.data?.message ||
        error?.message ||
        "No se pudo cargar el dashboard global";
    }
  } finally {
    globalLoading.value = false;
  }
};

const saveQuiniela = async () => {
  globalMessage.value = null;
  globalError.value = null;

  const payload = {
    name: quinielaForm.name.trim(),
    description: quinielaForm.description.trim() || null,
    access_code: quinielaForm.access_code.trim().toUpperCase(),
    start_date: toIsoOrNull(quinielaForm.start_date),
    end_date: toIsoOrNull(quinielaForm.end_date),
    admin_id: quinielaForm.admin_id.trim() || undefined,
  };

  if (!payload.name || !payload.access_code || !payload.start_date) {
    globalError.value =
      "Completa nombre, access code y fecha de inicio para guardar.";
    return;
  }

  savingQuiniela.value = true;

  try {
    if (quinielaForm.id) {
      await $fetch(`/api/admin/quinielas/${quinielaForm.id}`, {
        method: "PATCH",
        body: payload,
      });
      globalMessage.value = "Quiniela actualizada correctamente.";
    } else {
      await $fetch("/api/admin/quinielas", {
        method: "POST",
        body: payload,
      });
      globalMessage.value = "Quiniela creada correctamente.";
      resetQuinielaForm();
    }

    await loadGlobalStats(false);
  } catch (error: any) {
    globalError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo guardar la quiniela";
  } finally {
    savingQuiniela.value = false;
  }
};

const deleteQuiniela = async (quinielaId: string) => {
  if (process.client) {
    const confirmed = window.confirm(
      "Se eliminara la quiniela y su membresia asociada. Continuar?",
    );

    if (!confirmed) {
      return;
    }
  }

  globalMessage.value = null;
  globalError.value = null;
  deletingQuinielaId.value = quinielaId;

  try {
    await $fetch(`/api/admin/quinielas/${quinielaId}`, {
      method: "DELETE",
    });
    globalMessage.value = "Quiniela eliminada correctamente.";

    if (quinielaForm.id === quinielaId) {
      resetQuinielaForm();
    }

    await loadGlobalStats(false);
  } catch (error: any) {
    globalError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo eliminar la quiniela";
  } finally {
    deletingQuinielaId.value = null;
  }
};

const loadIngestionLogs = async () => {
  loadingLogs.value = true;
  logsError.value = null;

  const { data, error } = await client
    .from("matches")
    .select("id, home_team, away_team, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(12);

  loadingLogs.value = false;

  if (error) {
    logsError.value = error.message;
    return;
  }

  latestMatches.value =
    data?.map((item) => ({
      id: item.id as string,
      home_team: item.home_team as string,
      away_team: item.away_team as string,
      status: item.status as string,
      updated_at: new Date(item.updated_at as string).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })) ?? [];
};

const loadSyncStatus = async () => {
  syncError.value = null;

  try {
    const data = await $fetch<{
      requestsUsedToday: number;
      dailyBudget: number;
      remainingToday: number;
      state: {
        lastSyncedAt: string | null;
        lastStatus: string;
        lastError: string | null;
        lastResponseCount: number;
      };
    }>("/api/admin/sync-fixtures-status");

    syncStatus.value = data;
  } catch (error: any) {
    syncError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo cargar estado de sync";
  }
};

const runFixturesSync = async () => {
  syncingFixtures.value = true;
  syncMessage.value = null;
  syncError.value = null;

  try {
    const result = await $fetch<{
      skipped: boolean;
      reason?: string;
      savedMatches?: number;
      pulledFromApi?: number;
      skippedUnknownStage?: number;
      requestsUsedToday: number;
      dailyBudget: number;
    }>("/api/admin/sync-fixtures", {
      method: "POST",
      body: {
        force: forceSync.value,
      },
    });

    if (result.skipped) {
      syncMessage.value = result.reason || "Sync omitido por cooldown";
    } else {
      syncMessage.value = `Sync OK. API: ${result.pulledFromApi ?? 0}, guardados: ${result.savedMatches ?? 0}, descartados: ${result.skippedUnknownStage ?? 0}, cuota: ${result.requestsUsedToday}/${result.dailyBudget}`;
    }

    await loadSyncStatus();
    await loadIngestionLogs();
  } catch (error: any) {
    syncError.value =
      error?.data?.message || error?.message || "Error sincronizando fixtures";
  } finally {
    syncingFixtures.value = false;
  }
};

onMounted(async () => {
  await loadActiveQuiniela();
  await loadSyncStatus();
  await loadIngestionLogs();
  await loadGlobalStats(true);
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
          Admin
        </p>
        <h1 class="mt-1 text-3xl text-white">Panel de gestion</h1>
      </div>
      <button
        class="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="loadIngestionLogs"
      >
        Refrescar log
      </button>
    </header>

    <article class="pitch-panel rounded-2xl p-5" v-if="quiniela">
      <h2 class="text-xl text-emerald-200">Quiniela activa</h2>
      <p class="mt-2 text-lg text-white">{{ quiniela.name }}</p>
      <p class="mt-1 text-sm text-(--text-muted)">
        Access code: {{ quiniela.access_code }}
      </p>
      <p class="mt-1 text-sm text-(--text-muted)">
        Inicio: {{ new Date(quiniela.start_date).toLocaleString("es-MX") }}
      </p>
    </article>

    <article class="pitch-panel rounded-2xl p-5" v-if="isGlobalAdmin">
      <h2 class="text-xl text-white">Dashboard global</h2>
      <p class="mt-2 text-sm text-(--text-muted)">
        Como global admin puedes ver metricas totales y gestionar quinielas de
        toda la plataforma.
      </p>

      <p v-if="globalLoading" class="mt-4 text-sm text-(--text-muted)">
        Cargando dashboard global...
      </p>

      <p
        v-else-if="globalError"
        class="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        {{ globalError }}
      </p>

      <template v-else-if="globalStats">
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Usuarios
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.users }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Global admins
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.globalAdmins }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Quinielas
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.quinielas }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Miembros
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.members }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Partidos
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.matches }}
            </p>
          </div>
          <div class="rounded-xl border border-white/10 bg-black/35 p-4">
            <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
              Predicciones
            </p>
            <p class="mt-1 text-2xl font-semibold text-white">
              {{ globalStats.totals.predictions }}
            </p>
          </div>
        </div>

        <div class="mt-6 rounded-xl border border-white/10 bg-black/25 p-4">
          <h3 class="text-lg text-emerald-200">
            {{ quinielaForm.id ? "Editar quiniela" : "Crear quiniela" }}
          </h3>

          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Nombre
              </label>
              <input
                v-model="quinielaForm.name"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Quiniela principal"
              />
            </div>

            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Access code
              </label>
              <div class="flex gap-2">
                <input
                  v-model="quinielaForm.access_code"
                  maxlength="12"
                  class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 uppercase text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="ABC123"
                />
                <button
                  class="rounded-xl border border-white/15 px-3 text-xs text-slate-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
                  @click="randomAccessCode"
                >
                  Generar
                </button>
              </div>
            </div>

            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Admin user id
              </label>
              <input
                v-model="quinielaForm.admin_id"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
                placeholder="uuid del admin"
              />
            </div>

            <div class="space-y-1">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Inicio
              </label>
              <input
                v-model="quinielaForm.start_date"
                type="datetime-local"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
              />
            </div>

            <div class="space-y-1 md:col-span-2">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Fin (opcional)
              </label>
              <input
                v-model="quinielaForm.end_date"
                type="datetime-local"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
              />
            </div>

            <div class="space-y-1 md:col-span-2">
              <label
                class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
              >
                Descripcion
              </label>
              <textarea
                v-model="quinielaForm.description"
                rows="3"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Descripcion de la quiniela"
              />
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <button
              class="rounded-full border border-emerald-300/45 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingQuiniela"
              @click="saveQuiniela"
            >
              {{
                savingQuiniela
                  ? "Guardando..."
                  : quinielaForm.id
                    ? "Guardar cambios"
                    : "Crear quiniela"
              }}
            </button>
            <button
              v-if="quinielaForm.id"
              class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-white/35"
              @click="resetQuinielaForm"
            >
              Cancelar edicion
            </button>
          </div>

          <p
            v-if="globalMessage"
            class="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
          >
            {{ globalMessage }}
          </p>

          <p
            v-if="globalError"
            class="mt-3 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            {{ globalError }}
          </p>
        </div>

        <div class="mt-6 overflow-hidden rounded-xl border border-white/8">
          <table class="min-w-full text-sm">
            <thead
              class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              <tr>
                <th class="px-4 py-3">Quiniela</th>
                <th class="px-4 py-3">Admin</th>
                <th class="px-4 py-3">Codigo</th>
                <th class="px-4 py-3">Inicio</th>
                <th class="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in managedQuinielas"
                :key="item.id"
                class="border-t border-white/8"
              >
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-100">{{ item.name }}</p>
                  <p class="text-xs text-(--text-muted)">
                    {{ item.description || "Sin descripcion" }}
                  </p>
                </td>
                <td class="px-4 py-3">
                  <p class="text-slate-100">{{ item.admin_username }}</p>
                  <p class="text-xs text-(--text-muted)">{{ item.admin_id }}</p>
                </td>
                <td class="px-4 py-3 uppercase">{{ item.access_code }}</td>
                <td class="px-4 py-3 text-(--text-muted)">
                  {{ new Date(item.start_date).toLocaleString("es-MX") }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      class="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
                      @click="editQuiniela(item)"
                    >
                      Editar
                    </button>
                    <button
                      class="rounded-full border border-red-300/25 px-3 py-1 text-xs text-red-100 transition hover:border-red-200 hover:text-red-50 disabled:opacity-55"
                      :disabled="deletingQuinielaId === item.id"
                      @click="deleteQuiniela(item.id)"
                    >
                      {{
                        deletingQuinielaId === item.id
                          ? "Eliminando..."
                          : "Borrar"
                      }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </article>

    <article
      v-else
      class="pitch-panel rounded-2xl border border-amber-300/20 bg-amber-500/5 p-5"
    >
      <h2 class="text-xl text-amber-100">Acceso admin local</h2>
      <p class="mt-2 text-sm text-amber-100/85">
        Tu acceso actual permite administrar la quiniela activa. El dashboard
        global solo aparece para usuarios con flag is_global_admin.
      </p>
    </article>

    <article class="pitch-panel rounded-2xl p-5">
      <h2 class="text-xl text-white">Monitoreo de ingesta de API</h2>
      <p class="mt-2 text-sm text-(--text-muted)">
        Este bloque muestra los ultimos partidos actualizados en la tabla
        matches para verificar el pulso de ingesta.
      </p>

      <div
        class="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 space-y-3"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm text-slate-200">
            <p>
              Cuota API-FOOTBALL hoy:
              <span class="font-semibold text-emerald-200">
                {{ syncStatus?.requestsUsedToday ?? 0 }}/{{
                  syncStatus?.dailyBudget ?? 0
                }}
              </span>
              <span class="ml-2 text-(--text-muted)">
                (restantes: {{ syncStatus?.remainingToday ?? 0 }})
              </span>
            </p>
            <p class="mt-1 text-(--text-muted)">
              Ultimo sync:
              {{
                syncStatus?.state?.lastSyncedAt
                  ? new Date(syncStatus.state.lastSyncedAt).toLocaleString(
                      "es-MX",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                      },
                    )
                  : "sin ejecuciones"
              }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <label
              class="inline-flex items-center gap-2 text-xs text-(--text-muted)"
            >
              <input
                v-model="forceSync"
                type="checkbox"
                class="h-4 w-4 rounded border-white/20 bg-black/50"
              />
              Forzar sync
            </label>

            <button
              class="rounded-full border border-emerald-300/45 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="syncingFixtures"
              @click="runFixturesSync"
            >
              {{
                syncingFixtures ? "Sincronizando..." : "Sincronizar fixtures"
              }}
            </button>
          </div>
        </div>

        <p
          v-if="syncStatus?.state?.lastError"
          class="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          Ultimo error: {{ syncStatus.state.lastError }}
        </p>

        <p
          v-if="syncMessage"
          class="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
        >
          {{ syncMessage }}
        </p>

        <p
          v-if="syncError"
          class="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {{ syncError }}
        </p>
      </div>

      <p v-if="loadingLogs" class="mt-4 text-sm text-(--text-muted)">
        Cargando log...
      </p>
      <p
        v-else-if="logsError"
        class="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        {{ logsError }}
      </p>

      <div v-else class="mt-4 overflow-hidden rounded-xl border border-white/8">
        <table class="min-w-full text-sm">
          <thead
            class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            <tr>
              <th class="px-4 py-3">Partido</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in latestMatches"
              :key="entry.id"
              class="border-t border-white/8"
            >
              <td class="px-4 py-3">
                {{ entry.home_team }} vs {{ entry.away_team }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs font-semibold"
                  :class="[
                    entry.status === 'finished' &&
                      'bg-slate-200/15 text-slate-100',
                    entry.status === 'in_progress' &&
                      'bg-emerald-400/25 text-emerald-100',
                    entry.status === 'pending' &&
                      'bg-amber-400/20 text-amber-100',
                  ]"
                >
                  {{ entry.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-(--text-muted)">
                {{ entry.updated_at }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
