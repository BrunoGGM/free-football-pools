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

interface TeamProfileItem {
  id: string;
  api_team_id: number | null;
  team_key: string;
  name: string;
  code: string | null;
  country: string | null;
  logo_url: string | null;
  is_national: boolean | null;
  source_provider: string;
  updated_at: string;
}

type AdminSectionKey = "overview" | "quinielas" | "teams" | "ingestion";

const client = useSupabaseClient<any>();
const { quiniela, loadActiveQuiniela } = useActiveQuiniela();

const getAdminHeaders = async () => {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const adminFetch = async <T,>(url: string, options: any = {}) => {
  const authHeaders = await getAdminHeaders();

  return await $fetch<T>(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders,
    },
  });
};

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
const syncingTeams = ref(false);
const teamsSyncMessage = ref<string | null>(null);
const teamsSyncError = ref<string | null>(null);
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

const teamProfiles = ref<TeamProfileItem[]>([]);
const teamsTotal = ref(0);
const teamsLoading = ref(false);
const teamsError = ref<string | null>(null);
const teamsMessage = ref<string | null>(null);
const teamsSearch = ref("");
const savingTeamProfile = ref(false);
const deletingTeamProfileId = ref<string | null>(null);
const forceDeleteTeamProfile = ref(false);
const teamForm = reactive({
  id: "",
  name: "",
  code: "",
  country: "",
  logo_url: "",
  api_team_id: "",
  source_provider: "manual",
  is_national: true,
});

const isGlobalAdmin = computed(() => Boolean(globalStats.value?.isGlobalAdmin));
const managedQuinielas = computed(() => globalStats.value?.quinielas ?? []);
const adminSection = ref<AdminSectionKey>("overview");
const adminSections = computed(() => [
  {
    key: "overview" as AdminSectionKey,
    label: "Resumen",
    description: "Vista general",
  },
  {
    key: "quinielas" as AdminSectionKey,
    label: "Quinielas",
    description: isGlobalAdmin.value ? "Gestion global" : "Acceso local",
  },
  {
    key: "teams" as AdminSectionKey,
    label: "Equipos",
    description: "Catalogo y logos",
  },
  {
    key: "ingestion" as AdminSectionKey,
    label: "Ingesta API",
    description: "Sync y monitoreo",
  },
]);

const activeSectionLabel = computed(() => {
  const current = adminSections.value.find(
    (section) => section.key === adminSection.value,
  );

  return current?.label ?? "Seccion";
});

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
    const data = await adminFetch<GlobalStatsPayload>(
      "/api/admin/global-stats",
    );
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
      await adminFetch(`/api/admin/quinielas/${quinielaForm.id}`, {
        method: "PATCH",
        body: payload,
      });
      globalMessage.value = "Quiniela actualizada correctamente.";
    } else {
      await adminFetch("/api/admin/quinielas", {
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
    await adminFetch(`/api/admin/quinielas/${quinielaId}`, {
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
    const data = await adminFetch<{
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
    const result = await adminFetch<{
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

const runTeamsSync = async () => {
  syncingTeams.value = true;
  teamsSyncMessage.value = null;
  teamsSyncError.value = null;

  try {
    const result = await adminFetch<{
      totalTeamsDetected: number;
      searchedTeams: number;
      syncedProfiles: number;
      skippedCached: number;
      skippedPlaceholders: number;
      requestsExecuted: number;
      unresolvedTeams: string[];
    }>("/api/admin/sync-teams", {
      method: "POST",
      body: {
        force: forceSync.value,
      },
    });

    const unresolvedCount = result.unresolvedTeams?.length ?? 0;
    teamsSyncMessage.value = `Selecciones sync OK. detectadas: ${result.totalTeamsDetected}, buscadas (reales): ${result.searchedTeams}, placeholders omitidos: ${result.skippedPlaceholders}, cacheadas: ${result.syncedProfiles}, omitidas por cache: ${result.skippedCached}, requests: ${result.requestsExecuted}, sin match: ${unresolvedCount}`;

    await loadIngestionLogs();
  } catch (error: any) {
    teamsSyncError.value =
      error?.data?.message ||
      error?.message ||
      "Error sincronizando selecciones";
  } finally {
    syncingTeams.value = false;
  }
};

const loadTeamProfiles = async () => {
  teamsLoading.value = true;
  teamsError.value = null;

  try {
    const data = await adminFetch<{
      items: TeamProfileItem[];
      total: number;
    }>(
      `/api/admin/team-profiles?q=${encodeURIComponent(teamsSearch.value.trim())}&limit=50&offset=0`,
    );

    teamProfiles.value = data.items || [];
    teamsTotal.value = Number(data.total || 0);
  } catch (error: any) {
    teamsError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo cargar el catalogo de equipos";
  } finally {
    teamsLoading.value = false;
  }
};

const resetTeamForm = () => {
  teamForm.id = "";
  teamForm.name = "";
  teamForm.code = "";
  teamForm.country = "";
  teamForm.logo_url = "";
  teamForm.api_team_id = "";
  teamForm.source_provider = "manual";
  teamForm.is_national = true;
};

const editTeamProfile = (item: TeamProfileItem) => {
  teamForm.id = item.id;
  teamForm.name = item.name;
  teamForm.code = item.code ?? "";
  teamForm.country = item.country ?? "";
  teamForm.logo_url = item.logo_url ?? "";
  teamForm.api_team_id = item.api_team_id?.toString() ?? "";
  teamForm.source_provider = item.source_provider || "manual";
  teamForm.is_national = item.is_national ?? true;
  teamsMessage.value = null;
  teamsError.value = null;
};

const saveTeamProfile = async () => {
  teamsMessage.value = null;
  teamsError.value = null;

  const payload = {
    name: teamForm.name.trim(),
    code: teamForm.code.trim().toUpperCase() || null,
    country: teamForm.country.trim() || null,
    logo_url: teamForm.logo_url.trim() || null,
    api_team_id: teamForm.api_team_id.trim()
      ? Number(teamForm.api_team_id.trim())
      : null,
    source_provider: teamForm.source_provider.trim() || "manual",
    is_national: Boolean(teamForm.is_national),
  };

  if (!payload.name) {
    teamsError.value = "El nombre del equipo es obligatorio.";
    return;
  }

  if (
    payload.api_team_id !== null &&
    (Number.isNaN(payload.api_team_id) || payload.api_team_id <= 0)
  ) {
    teamsError.value = "api_team_id debe ser un numero positivo.";
    return;
  }

  savingTeamProfile.value = true;

  try {
    if (teamForm.id) {
      await adminFetch(`/api/admin/team-profiles/${teamForm.id}`, {
        method: "PATCH",
        body: payload,
      });
      teamsMessage.value = "Equipo actualizado correctamente.";
    } else {
      await adminFetch("/api/admin/team-profiles", {
        method: "POST",
        body: payload,
      });
      teamsMessage.value = "Equipo creado correctamente.";
      resetTeamForm();
    }

    await loadTeamProfiles();
  } catch (error: any) {
    teamsError.value =
      error?.data?.message || error?.message || "No se pudo guardar el equipo";
  } finally {
    savingTeamProfile.value = false;
  }
};

const deleteTeamProfile = async (item: TeamProfileItem) => {
  teamsMessage.value = null;
  teamsError.value = null;

  if (!isGlobalAdmin.value) {
    teamsError.value = "Solo global admin puede eliminar equipos del catalogo.";
    return;
  }

  if (process.client) {
    const warning = forceDeleteTeamProfile.value
      ? "Se eliminara el equipo y se limpiaran referencias de campeon en quinielas. Continuar?"
      : "Si el equipo esta en uso, no se eliminara. Deseas continuar?";

    const confirmed = window.confirm(warning);
    if (!confirmed) {
      return;
    }
  }

  deletingTeamProfileId.value = item.id;

  try {
    const result = await adminFetch<{
      deletedName: string;
      force: boolean;
      usage: { total: number };
      cleanup: {
        quinielasChampionCleared: number;
        membersChampionCleared: number;
      };
    }>(`/api/admin/team-profiles/${item.id}`, {
      method: "DELETE",
      body: {
        force: forceDeleteTeamProfile.value,
      },
    });

    teamsMessage.value = `Equipo eliminado: ${result.deletedName}. Limpieza quinielas: ${result.cleanup.quinielasChampionCleared}, miembros: ${result.cleanup.membersChampionCleared}.`;

    if (teamForm.id === item.id) {
      resetTeamForm();
    }

    await loadTeamProfiles();
  } catch (error: any) {
    teamsError.value =
      error?.data?.message || error?.message || "No se pudo eliminar el equipo";
  } finally {
    deletingTeamProfileId.value = null;
  }
};

const refreshCurrentSection = async () => {
  if (adminSection.value === "overview") {
    await Promise.all([
      loadActiveQuiniela(),
      loadGlobalStats(true),
      loadTeamProfiles(),
      loadSyncStatus(),
    ]);
    return;
  }

  if (adminSection.value === "quinielas") {
    await loadGlobalStats(true);
    return;
  }

  if (adminSection.value === "teams") {
    await loadTeamProfiles();
    return;
  }

  await Promise.all([loadSyncStatus(), loadIngestionLogs()]);
};

onMounted(async () => {
  await loadActiveQuiniela();
  await loadSyncStatus();
  await loadIngestionLogs();
  await loadGlobalStats(true);
  await loadTeamProfiles();
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">Admin</p>
        <h1 class="text-base-content mt-1 text-3xl">Panel de gestion</h1>
      </div>
      <button class="btn btn-outline btn-sm" @click="refreshCurrentSection">
        Refrescar {{ activeSectionLabel }}
      </button>
    </header>

    <nav class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="section in adminSections"
        :key="section.key"
        class="card rounded-2xl border px-4 py-3 text-left transition"
        :class="
          adminSection === section.key
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-base-300 bg-base-100/70 text-base-content hover:border-primary/40'
        "
        @click="adminSection = section.key"
      >
        <p class="text-sm font-semibold">{{ section.label }}</p>
        <p class="mt-1 text-xs opacity-80">{{ section.description }}</p>
      </button>
    </nav>

    <AdminOverviewSection
      v-if="adminSection === 'overview'"
      :quiniela="quiniela"
      :global-stats="globalStats"
      :teams-total="teamsTotal"
      :sync-status="syncStatus"
      @navigate="adminSection = $event"
    />

    <AdminQuinielasSection
      v-if="adminSection === 'quinielas'"
      :is-global-admin="isGlobalAdmin"
      :global-loading="globalLoading"
      :global-error="globalError"
      :global-message="globalMessage"
      :global-stats="globalStats"
      :managed-quinielas="managedQuinielas"
      :quiniela-form="quinielaForm"
      :saving-quiniela="savingQuiniela"
      :deleting-quiniela-id="deletingQuinielaId"
      @random-access-code="randomAccessCode"
      @save-quiniela="saveQuiniela"
      @reset-quiniela-form="resetQuinielaForm"
      @edit-quiniela="editQuiniela"
      @delete-quiniela="deleteQuiniela"
    />

    <AdminTeamsSection
      v-if="adminSection === 'teams'"
      :team-profiles="teamProfiles"
      :teams-total="teamsTotal"
      :teams-loading="teamsLoading"
      :teams-error="teamsError"
      :teams-message="teamsMessage"
      :teams-search="teamsSearch"
      :saving-team-profile="savingTeamProfile"
      :deleting-team-profile-id="deletingTeamProfileId"
      :force-delete-team-profile="forceDeleteTeamProfile"
      :is-global-admin="isGlobalAdmin"
      :team-form="teamForm"
      @load-team-profiles="loadTeamProfiles"
      @save-team-profile="saveTeamProfile"
      @reset-team-form="resetTeamForm"
      @edit-team-profile="editTeamProfile"
      @delete-team-profile="deleteTeamProfile"
      @update:teams-search="teamsSearch = $event"
      @update:force-delete-team-profile="forceDeleteTeamProfile = $event"
    />

    <AdminIngestionSection
      v-if="adminSection === 'ingestion'"
      :sync-status="syncStatus"
      :force-sync="forceSync"
      :syncing-fixtures="syncingFixtures"
      :syncing-teams="syncingTeams"
      :sync-message="syncMessage"
      :teams-sync-message="teamsSyncMessage"
      :sync-error="syncError"
      :teams-sync-error="teamsSyncError"
      :loading-logs="loadingLogs"
      :logs-error="logsError"
      :latest-matches="latestMatches"
      @run-fixtures-sync="runFixturesSync"
      @run-teams-sync="runTeamsSync"
      @update:force-sync="forceSync = $event"
    />
  </section>
</template>
