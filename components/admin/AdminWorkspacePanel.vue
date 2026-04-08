<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    mode: "local" | "global";
  }>(),
  {
    mode: "local",
  },
);

type AdminViewMode = "local" | "global";

const viewMode = computed<AdminViewMode>(() => props.mode);
const isGlobalView = computed(() => viewMode.value === "global");

const viewTitle = computed(() =>
  isGlobalView.value ? "Admin global" : "Admin de quiniela",
);

const viewDescription = computed(() =>
  isGlobalView.value
    ? "Gestion centralizada de todas las quinielas, catalogo de selecciones e ingesta API."
    : "Gestion local de tu(s) quiniela(s), configuracion y ajustes a jugadores.",
);

const canUseGlobalFeatures = computed(
  () => isGlobalAdmin.value && isGlobalView.value,
);

const canCreateQuinielas = computed(() => canUseGlobalFeatures.value);
const canDeleteQuinielas = computed(() => canUseGlobalFeatures.value);
const canManageTeams = computed(() => canUseGlobalFeatures.value);
const canUseIngestion = computed(() => true);
const canRunIngestionSync = computed(() => canUseGlobalFeatures.value);

const modeSkin = computed(() => {
  if (isGlobalView.value) {
    return {
      bannerClass:
        "border-warning/30 bg-gradient-to-r from-warning/15 via-base-100/80 to-info/15",
      badgeClass: "badge-warning",
      badgeLabel: "Control global",
      badgeHint: "Todas las quinielas, API y catalogo",
      activeNavClass: "border-warning/60 bg-warning/15 text-warning",
      idleNavClass: "border-base-300 bg-base-100/70 hover:border-warning/40",
    };
  }

  return {
    bannerClass:
      "border-success/30 bg-gradient-to-r from-success/15 via-base-100/80 to-primary/10",
    badgeClass: "badge-success",
    badgeLabel: "Operacion local",
    badgeHint: "Tu quiniela y tus jugadores",
    activeNavClass: "border-success/60 bg-success/15 text-success",
    idleNavClass: "border-base-300 bg-base-100/70 hover:border-success/40",
  };
});

const sectionIcon = (section: AdminSectionKey) => {
  if (section === "overview") {
    return "▦";
  }

  if (section === "quinielas") {
    return "⚙";
  }

  if (section === "teams") {
    return "◉";
  }

  return "⟳";
};

const isViewForbidden = computed(
  () => isGlobalView.value && !globalLoading.value && !isGlobalAdmin.value,
);

interface ManagedQuiniela {
  id: string;
  name: string;
  description: string | null;
  access_code: string;
  has_test_data: boolean;
  ticket_price: number;
  start_date: string;
  end_date: string | null;
  champion_team: string | null;
  admin_id: string;
  admin_username: string;
  created_at: string;
  rules: {
    exact_score_points: number;
    correct_outcome_points: number;
    champion_bonus_points: number;
    allow_member_predictions_view: boolean;
  };
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
  } | null;
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
type MatchStatus = "pending" | "in_progress" | "finished";
type SimulationSegment =
  | "all"
  | "group_stage"
  | "round_32"
  | "round_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

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
    stage: string;
    match_time: string;
    match_time_iso: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    home_penalty_score: number | null;
    away_penalty_score: number | null;
    status: string;
    updated_at: string;
  }[]
>([]);
const matchesSearch = ref("");
const matchesStageFilter = ref("all");
const matchesPage = ref(1);
const MATCHES_PAGE_SIZE = 12;
const savingMatchScoreId = ref<string | null>(null);
const matchScoreMessage = ref<string | null>(null);
const matchScoreError = ref<string | null>(null);
const matchScoreDraftById = ref<
  Record<
    string,
    {
      home_score: string;
      away_score: string;
      home_penalty_score: string;
      away_penalty_score: string;
      status: MatchStatus;
    }
  >
>({});
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
const applyingManualPoints = ref(false);
const manualPointsMessage = ref<string | null>(null);
const manualPointsError = ref<string | null>(null);

const quinielaForm = reactive({
  id: "",
  name: "",
  description: "",
  access_code: "",
  ticket_price: 0,
  start_date: "",
  end_date: "",
  admin_id: "",
  exact_score_points: 3,
  correct_outcome_points: 1,
  champion_bonus_points: 10,
  allow_member_predictions_view: false,
});

const manualPointsForm = reactive({
  quiniela_id: "",
  user_id: "",
  points_delta: 1,
  reason: "",
});

const simulationForm = reactive({
  quiniela_id: "",
  segment: "all" as SimulationSegment,
  simulate_scores: true,
  simulate_population: false,
  test_users_count: 12,
  reset_test_data: true,
});
const runningSimulation = ref(false);
const clearingSimulationData = ref(false);
const simulationMessage = ref<string | null>(null);
const simulationError = ref<string | null>(null);

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
const globalStatsForView = computed(() => {
  if (!globalStats.value) {
    return null;
  }

  return {
    ...globalStats.value,
    totals: globalStats.value.totals ?? undefined,
  };
});
const adminRoleLabel = computed(() => {
  if (isGlobalAdmin.value) {
    return "Admin global";
  }

  return "Admin de quiniela";
});

const MATCH_STAGE_ORDER: Record<string, number> = {
  group_stage: 1,
  round_32: 2,
  round_16: 3,
  quarter_final: 4,
  semi_final: 5,
  third_place: 6,
  final: 7,
};

const formatMatchStageLabel = (stage: string) => {
  return stage.replaceAll("_", " ");
};

const adminSection = ref<AdminSectionKey>("overview");
const matchStageOptions = computed(() => {
  const uniqueStages = Array.from(
    new Set(latestMatches.value.map((item) => item.stage).filter(Boolean)),
  );

  uniqueStages.sort((a, b) => {
    const orderA = MATCH_STAGE_ORDER[a] ?? Number.MAX_SAFE_INTEGER;
    const orderB = MATCH_STAGE_ORDER[b] ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.localeCompare(b);
  });

  return uniqueStages.map((stage) => ({
    value: stage,
    label: formatMatchStageLabel(stage),
  }));
});

const filteredMatches = computed(() => {
  const query = matchesSearch.value.trim().toLowerCase();
  const stageFilter = matchesStageFilter.value;

  const sorted = [...latestMatches.value].sort((a, b) => {
    return (
      new Date(a.match_time_iso).getTime() -
      new Date(b.match_time_iso).getTime()
    );
  });

  const stageFiltered =
    stageFilter === "all"
      ? sorted
      : sorted.filter((item) => item.stage === stageFilter);

  if (!query) {
    return stageFiltered;
  }

  return stageFiltered.filter((item) => {
    const stageLabel = item.stage.replaceAll("_", " ");
    const haystack = [
      item.home_team,
      item.away_team,
      stageLabel,
      item.status,
      item.match_time,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});
const matchesTotalPages = computed(() => {
  return Math.max(
    1,
    Math.ceil(filteredMatches.value.length / MATCHES_PAGE_SIZE),
  );
});
const paginatedMatches = computed(() => {
  const start = (matchesPage.value - 1) * MATCHES_PAGE_SIZE;
  return filteredMatches.value.slice(start, start + MATCHES_PAGE_SIZE);
});
const matchesShowingStart = computed(() => {
  if (filteredMatches.value.length === 0) {
    return 0;
  }

  return (matchesPage.value - 1) * MATCHES_PAGE_SIZE + 1;
});
const matchesShowingEnd = computed(() => {
  if (filteredMatches.value.length === 0) {
    return 0;
  }

  return Math.min(
    matchesPage.value * MATCHES_PAGE_SIZE,
    filteredMatches.value.length,
  );
});

const goToMatchesPage = (page: number) => {
  const clamped = Math.min(Math.max(page, 1), matchesTotalPages.value);
  matchesPage.value = clamped;
};
const adminSections = computed(() => {
  const sections = [
    {
      key: "overview" as AdminSectionKey,
      label: "Resumen",
      description: "Vista general",
    },
    {
      key: "quinielas" as AdminSectionKey,
      label: "Quiniela",
      description: "Configuracion y jugadores",
    },
  ];

  if (canUseGlobalFeatures.value) {
    sections.push({
      key: "teams" as AdminSectionKey,
      label: "Selecciones",
      description: "Catalogo y logos",
    });
  }

  sections.push({
    key: "ingestion" as AdminSectionKey,
    label: "Partidos",
    description: canUseGlobalFeatures.value
      ? "Sync API y marcadores manuales"
      : "Marcadores manuales",
  });

  return sections;
});

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
  quinielaForm.ticket_price = 0;
  quinielaForm.start_date = "";
  quinielaForm.end_date = "";
  quinielaForm.admin_id = "";
  quinielaForm.exact_score_points = 3;
  quinielaForm.correct_outcome_points = 1;
  quinielaForm.champion_bonus_points = 10;
  quinielaForm.allow_member_predictions_view = false;
};

const editQuiniela = (item: ManagedQuiniela) => {
  quinielaForm.id = item.id;
  quinielaForm.name = item.name;
  quinielaForm.description = item.description ?? "";
  quinielaForm.access_code = item.access_code;
  quinielaForm.ticket_price = Number(item.ticket_price ?? 0);
  quinielaForm.start_date = toInputDateTime(item.start_date);
  quinielaForm.end_date = toInputDateTime(item.end_date);
  quinielaForm.admin_id = item.admin_id;
  quinielaForm.exact_score_points = Number(item.rules?.exact_score_points ?? 3);
  quinielaForm.correct_outcome_points = Number(
    item.rules?.correct_outcome_points ?? 1,
  );
  quinielaForm.champion_bonus_points = Number(
    item.rules?.champion_bonus_points ?? 10,
  );
  quinielaForm.allow_member_predictions_view = Boolean(
    item.rules?.allow_member_predictions_view ?? false,
  );
  manualPointsForm.quiniela_id = item.id;
  globalMessage.value = null;
  globalError.value = null;
};

const applyManualPoints = async () => {
  manualPointsMessage.value = null;
  manualPointsError.value = null;

  const quinielaId = manualPointsForm.quiniela_id.trim();
  const userId = manualPointsForm.user_id.trim();
  const pointsDelta = Number(manualPointsForm.points_delta);
  const reason = manualPointsForm.reason.trim() || null;

  if (!quinielaId || !userId) {
    manualPointsError.value =
      "Selecciona quiniela y user id para aplicar ajuste.";
    return;
  }

  if (!Number.isInteger(pointsDelta) || pointsDelta === 0) {
    manualPointsError.value =
      "El ajuste debe ser un numero entero distinto de 0.";
    return;
  }

  applyingManualPoints.value = true;

  try {
    const result = await adminFetch<{
      ranking: {
        rank: number;
        total_points: number;
        manual_points: number;
      } | null;
    }>(`/api/admin/quinielas/${quinielaId}/manual-points`, {
      method: "POST",
      body: {
        user_id: userId,
        points_delta: pointsDelta,
        reason,
      },
    });

    manualPointsMessage.value = result.ranking
      ? `Ajuste aplicado. Nuevo total: ${result.ranking.total_points} pts (manual: ${result.ranking.manual_points}, rank: #${result.ranking.rank}).`
      : "Ajuste aplicado correctamente.";
    manualPointsForm.points_delta = 1;
    manualPointsForm.reason = "";
  } catch (error: any) {
    manualPointsError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo aplicar el ajuste manual";
  } finally {
    applyingManualPoints.value = false;
  }
};

const simulationSegmentLabel = (segment: SimulationSegment) => {
  const labels: Record<SimulationSegment, string> = {
    all: "Todo el torneo",
    group_stage: "Fase de grupos",
    round_32: "Dieciseisavos",
    round_16: "Octavos",
    quarter_final: "Cuartos",
    semi_final: "Semifinal",
    third_place: "Tercer lugar",
    final: "Final",
  };

  return labels[segment];
};

const runSimulation = async () => {
  simulationMessage.value = null;
  simulationError.value = null;

  if (!canUseGlobalFeatures.value) {
    simulationError.value = "Solo admin global puede ejecutar simulaciones.";
    return;
  }

  const quinielaId = simulationForm.quiniela_id.trim();

  if (!quinielaId) {
    simulationError.value = "Selecciona una quiniela para simular.";
    return;
  }

  if (!simulationForm.simulate_scores && !simulationForm.simulate_population) {
    simulationError.value = "Activa al menos una opcion de simulacion.";
    return;
  }

  if (
    simulationForm.simulate_population &&
    (!Number.isInteger(simulationForm.test_users_count) ||
      simulationForm.test_users_count < 1)
  ) {
    simulationError.value =
      "La cantidad de usuarios de prueba debe ser un entero >= 1.";
    return;
  }

  runningSimulation.value = true;

  try {
    const result = await adminFetch<{
      summary: {
        scores_updated: number;
        knockout_ties_resolved: number;
        snapshot_captured: boolean;
        snapshot_matches: number;
        knockout_downstream_reset: number;
        users_created: number;
        users_reused: number;
        predictions_upserted: number;
        admin_predictions_generated: number;
      };
      quiniela: {
        has_test_data: boolean;
      };
      segment: {
        key: SimulationSegment;
      };
    }>(`/api/admin/quinielas/${quinielaId}/simulate`, {
      method: "POST",
      body: {
        segment: simulationForm.segment,
        simulate_scores: simulationForm.simulate_scores,
        simulate_population: simulationForm.simulate_population,
        test_users_count: simulationForm.test_users_count,
        reset_test_data:
          simulationForm.simulate_population && simulationForm.reset_test_data,
      },
    });

    simulationMessage.value = `Simulacion ejecutada (${simulationSegmentLabel(result.segment.key)}). Marcadores actualizados: ${result.summary.scores_updated}, empates KO resueltos: ${result.summary.knockout_ties_resolved}, llaves KO reiniciadas: ${result.summary.knockout_downstream_reset}, snapshot global ${result.summary.snapshot_captured ? `capturado (${result.summary.snapshot_matches})` : "reusado"}, usuarios reusados: ${result.summary.users_reused}, usuarios creados: ${result.summary.users_created}, predicciones generadas: ${result.summary.predictions_upserted}, predicciones admin: ${result.summary.admin_predictions_generated}. Lock pruebas: ${result.quiniela.has_test_data ? "ACTIVO" : "INACTIVO"}.`;

    await Promise.all([loadGlobalStats(false), loadIngestionLogs()]);
  } catch (error: any) {
    simulationError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo ejecutar la simulacion";
  } finally {
    runningSimulation.value = false;
  }
};

const clearSimulationData = async () => {
  simulationMessage.value = null;
  simulationError.value = null;

  if (!canUseGlobalFeatures.value) {
    simulationError.value =
      "Solo admin global puede limpiar registros de prueba.";
    return;
  }

  const quinielaId = simulationForm.quiniela_id.trim();

  if (!quinielaId) {
    simulationError.value = "Selecciona una quiniela para limpiar pruebas.";
    return;
  }

  if (process.client) {
    const confirmed = window.confirm(
      "Se eliminaran usuarios/predicciones de prueba. Si existe snapshot, se restauraran los partidos globales a su estado original; si no, se reseteara el segmento seleccionado. Continuar?",
    );

    if (!confirmed) {
      return;
    }
  }

  clearingSimulationData.value = true;

  try {
    const result = await adminFetch<{
      quiniela: {
        has_test_data: boolean;
      };
      summary: {
        matches_restored_from_snapshot: number;
        matches_reset: number;
      };
    }>(`/api/admin/quinielas/${quinielaId}/simulate`, {
      method: "DELETE",
      body: {
        segment: simulationForm.segment,
        reset_scores: true,
      },
    });

    simulationMessage.value = `Registros de prueba limpiados. Partidos restaurados (snapshot): ${result.summary.matches_restored_from_snapshot}, reseteados (fallback): ${result.summary.matches_reset}. Lock pruebas: ${result.quiniela.has_test_data ? "ACTIVO" : "INACTIVO"}.`;
    await Promise.all([loadGlobalStats(false), loadIngestionLogs()]);
  } catch (error: any) {
    simulationError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudieron limpiar los registros de prueba";
  } finally {
    clearingSimulationData.value = false;
  }
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

  if (!canCreateQuinielas.value && !quinielaForm.id) {
    globalError.value =
      "Como admin local solo puedes editar una quiniela existente.";
    return;
  }

  const payload = {
    name: quinielaForm.name.trim(),
    description: quinielaForm.description.trim() || null,
    access_code: quinielaForm.access_code.trim().toUpperCase(),
    ticket_price: Number(quinielaForm.ticket_price),
    start_date: toIsoOrNull(quinielaForm.start_date),
    end_date: toIsoOrNull(quinielaForm.end_date),
    admin_id: canCreateQuinielas.value
      ? quinielaForm.admin_id.trim() || undefined
      : undefined,
    exact_score_points: Number(quinielaForm.exact_score_points),
    correct_outcome_points: Number(quinielaForm.correct_outcome_points),
    champion_bonus_points: Number(quinielaForm.champion_bonus_points),
    allow_member_predictions_view: Boolean(
      quinielaForm.allow_member_predictions_view,
    ),
  };

  if (!payload.name || !payload.access_code || !payload.start_date) {
    globalError.value =
      "Completa nombre, access code y fecha de inicio para guardar.";
    return;
  }

  if (Number.isNaN(payload.ticket_price) || payload.ticket_price < 0) {
    globalError.value =
      "El costo por boleto debe ser un numero mayor o igual a 0.";
    return;
  }

  const integerRuleFields: Array<keyof typeof payload> = [
    "exact_score_points",
    "correct_outcome_points",
    "champion_bonus_points",
  ];

  for (const field of integerRuleFields) {
    const value = Number(payload[field]);

    if (!Number.isInteger(value)) {
      globalError.value = `El campo ${field} debe ser un entero.`;
      return;
    }
  }

  if (payload.correct_outcome_points > payload.exact_score_points) {
    globalError.value =
      "Puntos por signo no puede ser mayor que puntos por marcador exacto.";
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
  if (!canDeleteQuinielas.value) {
    globalError.value = "Solo admin global puede eliminar quinielas.";
    return;
  }

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
    .select("*")
    .order("match_time", { ascending: true });

  loadingLogs.value = false;

  if (error) {
    logsError.value = error.message;
    return;
  }

  latestMatches.value =
    data?.map((item) => ({
      id: item.id as string,
      stage: item.stage as string,
      match_time_iso: item.match_time as string,
      match_time: new Date(item.match_time as string).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      home_team: item.home_team as string,
      away_team: item.away_team as string,
      home_score:
        item.home_score === null || item.home_score === undefined
          ? null
          : Number(item.home_score),
      away_score:
        item.away_score === null || item.away_score === undefined
          ? null
          : Number(item.away_score),
      home_penalty_score:
        item.home_penalty_score === null ||
        item.home_penalty_score === undefined
          ? null
          : Number(item.home_penalty_score),
      away_penalty_score:
        item.away_penalty_score === null ||
        item.away_penalty_score === undefined
          ? null
          : Number(item.away_penalty_score),
      status: item.status as string,
      updated_at: new Date(item.updated_at as string).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    })) ?? [];

  goToMatchesPage(matchesPage.value);

  const nextDrafts: typeof matchScoreDraftById.value = {};

  for (const item of latestMatches.value) {
    const previous = matchScoreDraftById.value[item.id];

    nextDrafts[item.id] = {
      home_score:
        previous?.home_score ??
        (item.home_score === null ? "" : String(item.home_score)),
      away_score:
        previous?.away_score ??
        (item.away_score === null ? "" : String(item.away_score)),
      home_penalty_score:
        previous?.home_penalty_score ??
        (item.home_penalty_score === null
          ? ""
          : String(item.home_penalty_score)),
      away_penalty_score:
        previous?.away_penalty_score ??
        (item.away_penalty_score === null
          ? ""
          : String(item.away_penalty_score)),
      status: previous?.status ?? ((item.status as MatchStatus) || "pending"),
    };
  }

  matchScoreDraftById.value = nextDrafts;
};

watch([matchesSearch, matchesStageFilter], () => {
  matchesPage.value = 1;
});

watch(matchesTotalPages, (value) => {
  if (matchesPage.value > value) {
    matchesPage.value = value;
  }
});

const updateMatchScoreDraft = (payload: {
  id: string;
  field:
    | "home_score"
    | "away_score"
    | "home_penalty_score"
    | "away_penalty_score"
    | "status";
  value: string;
}) => {
  const current =
    matchScoreDraftById.value[payload.id] ||
    ({
      home_score: "",
      away_score: "",
      home_penalty_score: "",
      away_penalty_score: "",
      status: "pending",
    } as {
      home_score: string;
      away_score: string;
      home_penalty_score: string;
      away_penalty_score: string;
      status: MatchStatus;
    });

  if (payload.field === "status") {
    const value = payload.value as MatchStatus;

    matchScoreDraftById.value[payload.id] = {
      ...current,
      status: value,
    };

    return;
  }

  matchScoreDraftById.value[payload.id] = {
    ...current,
    [payload.field]: payload.value,
  };
};

const saveMatchScore = async (matchId: string) => {
  const draft = matchScoreDraftById.value[matchId];
  const targetMatch = latestMatches.value.find((item) => item.id === matchId);

  matchScoreMessage.value = null;
  matchScoreError.value = null;

  if (!draft) {
    matchScoreError.value = "No se encontro borrador para el partido.";
    return;
  }

  if (!targetMatch) {
    matchScoreError.value = "No se encontro partido para validar el borrador.";
    return;
  }

  const isKnockoutStage = [
    "round_32",
    "round_16",
    "quarter_final",
    "semi_final",
    "third_place",
    "final",
  ].includes(targetMatch.stage);

  const parseDraftScore = (raw: string): number | null => {
    const value = raw.trim();

    if (!value) {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("Marcador invalido. Usa enteros >= 0.");
    }

    return parsed;
  };

  let homeScore: number | null;
  let awayScore: number | null;
  let homePenaltyScore: number | null;
  let awayPenaltyScore: number | null;

  try {
    homeScore = parseDraftScore(draft.home_score);
    awayScore = parseDraftScore(draft.away_score);
    homePenaltyScore = parseDraftScore(draft.home_penalty_score);
    awayPenaltyScore = parseDraftScore(draft.away_penalty_score);
  } catch (error: any) {
    matchScoreError.value = error?.message || "Marcador invalido";
    return;
  }

  if ((homeScore === null) !== (awayScore === null)) {
    matchScoreError.value =
      "Debes capturar ambos marcadores o dejar ambos vacios.";
    return;
  }

  if ((homePenaltyScore === null) !== (awayPenaltyScore === null)) {
    matchScoreError.value =
      "Debes capturar ambos penales o dejar ambos vacios.";
    return;
  }

  if (
    draft.status === "finished" &&
    (homeScore === null || awayScore === null)
  ) {
    matchScoreError.value =
      "Para finalizar un partido debes enviar ambos marcadores.";
    return;
  }

  if (
    draft.status === "finished" &&
    isKnockoutStage &&
    homeScore === awayScore
  ) {
    if (homePenaltyScore === null || awayPenaltyScore === null) {
      matchScoreError.value =
        "En eliminatoria, si hay empate debes capturar penales.";
      return;
    }

    if (homePenaltyScore === awayPenaltyScore) {
      matchScoreError.value = "En penales no puede haber empate.";
      return;
    }
  }

  if (
    draft.status !== "finished" ||
    homeScore !== awayScore ||
    !isKnockoutStage
  ) {
    homePenaltyScore = null;
    awayPenaltyScore = null;
  }

  savingMatchScoreId.value = matchId;

  try {
    const payload: Record<string, unknown> = {
      home_score: homeScore,
      away_score: awayScore,
      status: draft.status,
    };

    if (homePenaltyScore !== null && awayPenaltyScore !== null) {
      payload.home_penalty_score = homePenaltyScore;
      payload.away_penalty_score = awayPenaltyScore;
    }

    await adminFetch(`/api/admin/matches/${matchId}/score`, {
      method: "PATCH",
      body: payload,
    });

    matchScoreMessage.value = "Marcador actualizado correctamente.";
    await loadIngestionLogs();
  } catch (error: any) {
    matchScoreError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo actualizar el marcador";
  } finally {
    savingMatchScoreId.value = null;
  }
};

const loadSyncStatus = async (silentIfForbidden = false) => {
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
    const statusCode = Number(error?.statusCode || error?.status || 0);

    if (silentIfForbidden && statusCode === 403) {
      syncStatus.value = null;
      return;
    }

    syncError.value =
      error?.data?.message ||
      error?.message ||
      "No se pudo cargar estado de sync";
  }
};

const runFixturesSync = async () => {
  if (!canRunIngestionSync.value) {
    syncError.value = "Solo admin global puede ejecutar sincronizaciones API.";
    return;
  }

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
  if (!canRunIngestionSync.value) {
    teamsSyncError.value =
      "Solo admin global puede sincronizar selecciones y logos.";
    return;
  }

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

const loadTeamProfiles = async (silentIfForbidden = false) => {
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
    const statusCode = Number(error?.statusCode || error?.status || 0);

    if (silentIfForbidden && statusCode === 403) {
      teamProfiles.value = [];
      teamsTotal.value = 0;
      teamsLoading.value = false;
      return;
    }

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

  if (!canManageTeams.value) {
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
    await loadActiveQuiniela();
    await loadGlobalStats(true);

    if (canUseGlobalFeatures.value) {
      await Promise.all([loadTeamProfiles(), loadSyncStatus()]);
    }

    return;
  }

  if (adminSection.value === "quinielas") {
    await loadGlobalStats(true);
    return;
  }

  if (adminSection.value === "teams") {
    if (!canManageTeams.value) {
      adminSection.value = "overview";
      return;
    }

    await loadTeamProfiles();
    return;
  }

  if (!canUseIngestion.value) {
    adminSection.value = "overview";
    return;
  }

  if (canRunIngestionSync.value) {
    await Promise.all([loadSyncStatus(), loadIngestionLogs()]);
    return;
  }

  syncStatus.value = null;
  await loadIngestionLogs();
};

onMounted(async () => {
  await loadActiveQuiniela();
  await loadGlobalStats(true);

  if (canUseGlobalFeatures.value) {
    await loadSyncStatus(true);
    await loadIngestionLogs();
    await loadTeamProfiles(true);
    return;
  }

  await loadIngestionLogs();
});

watch(
  () => adminSections.value.map((section) => section.key),
  (availableSections) => {
    if (!availableSections.includes(adminSection.value)) {
      adminSection.value = "overview";
    }
  },
  { immediate: true },
);

watch(
  () => managedQuinielas.value,
  (items) => {
    if (
      simulationForm.quiniela_id &&
      !items.some((item) => item.id === simulationForm.quiniela_id)
    ) {
      simulationForm.quiniela_id = "";
    }

    if (!simulationForm.quiniela_id && items.length > 0) {
      simulationForm.quiniela_id = items[0]!.id;
    }

    if (canUseGlobalFeatures.value) {
      return;
    }

    if (items.length === 0) {
      if (quinielaForm.id) {
        resetQuinielaForm();
      }
      manualPointsForm.quiniela_id = "";
      return;
    }

    if (
      !quinielaForm.id ||
      !items.some((item) => item.id === quinielaForm.id)
    ) {
      editQuiniela(items[0]!);
    }

    if (!manualPointsForm.quiniela_id) {
      manualPointsForm.quiniela_id = items[0]!.id;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-6">
    <header
      class="rounded-3xl border p-5 shadow-sm"
      :class="modeSkin.bannerClass"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-primary text-xs uppercase tracking-[0.18em]">Admin</p>
          <h1 class="text-base-content mt-1 text-3xl">{{ viewTitle }}</h1>
          <p class="text-base-content/70 mt-1 text-sm">
            {{ viewDescription }}
          </p>
          <p class="text-base-content/70 mt-2 text-sm">
            Alcance real:
            <span class="font-semibold">{{ adminRoleLabel }}</span>
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="badge badge-outline" :class="modeSkin.badgeClass">
            {{ modeSkin.badgeLabel }}
          </span>
          <span class="text-base-content/70 text-xs">{{
            modeSkin.badgeHint
          }}</span>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <NuxtLink
          to="/admin/local"
          class="btn btn-sm"
          :class="isGlobalView ? 'btn-outline' : 'btn-primary'"
        >
          Vista local
        </NuxtLink>
        <NuxtLink
          to="/admin/global"
          class="btn btn-sm"
          :class="isGlobalView ? 'btn-primary' : 'btn-outline'"
        >
          Vista global
        </NuxtLink>
        <button class="btn btn-outline btn-sm" @click="refreshCurrentSection">
          Refrescar {{ activeSectionLabel }}
        </button>
      </div>
    </header>

    <article v-if="isViewForbidden" class="alert alert-warning rounded-2xl">
      Esta vista es exclusiva para admins globales.
      <NuxtLink to="/admin/local" class="link link-hover ml-2 font-semibold"
        >Ir a vista local</NuxtLink
      >
    </article>

    <nav
      v-else
      class="grid gap-2 sm:grid-cols-2"
      :class="canUseGlobalFeatures ? 'xl:grid-cols-4' : 'xl:grid-cols-2'"
    >
      <button
        v-for="section in adminSections"
        :key="section.key"
        class="card rounded-2xl border px-4 py-3 text-left transition-colors"
        :class="
          adminSection === section.key
            ? modeSkin.activeNavClass
            : `${modeSkin.idleNavClass} text-base-content`
        "
        @click="adminSection = section.key"
      >
        <p class="flex items-center gap-2 text-sm font-semibold">
          <span class="opacity-80">{{ sectionIcon(section.key) }}</span>
          <span>{{ section.label }}</span>
        </p>
        <p class="mt-1 text-xs opacity-80">{{ section.description }}</p>
      </button>
    </nav>

    <AdminOverviewSection
      v-if="!isViewForbidden && adminSection === 'overview'"
      :quiniela="quiniela"
      :is-global-admin="canUseGlobalFeatures"
      :global-stats="globalStatsForView"
      :managed-quinielas-count="managedQuinielas.length"
      :teams-total="teamsTotal"
      :sync-status="syncStatus"
      @navigate="adminSection = $event"
    />

    <AdminQuinielasSection
      v-if="!isViewForbidden && adminSection === 'quinielas'"
      :is-global-admin="canUseGlobalFeatures"
      :global-loading="globalLoading"
      :global-error="globalError"
      :global-message="globalMessage"
      :global-stats="globalStatsForView"
      :managed-quinielas="managedQuinielas"
      :quiniela-form="quinielaForm"
      :saving-quiniela="savingQuiniela"
      :deleting-quiniela-id="deletingQuinielaId"
      :manual-points-form="manualPointsForm"
      :applying-manual-points="applyingManualPoints"
      :manual-points-message="manualPointsMessage"
      :manual-points-error="manualPointsError"
      :simulation-form="simulationForm"
      :running-simulation="runningSimulation"
      :clearing-simulation-data="clearingSimulationData"
      :simulation-message="simulationMessage"
      :simulation-error="simulationError"
      @random-access-code="randomAccessCode"
      @save-quiniela="saveQuiniela"
      @reset-quiniela-form="resetQuinielaForm"
      @edit-quiniela="editQuiniela"
      @delete-quiniela="deleteQuiniela"
      @apply-manual-points="applyManualPoints"
      @run-simulation="runSimulation"
      @clear-simulation-data="clearSimulationData"
    />

    <AdminTeamsSection
      v-if="!isViewForbidden && adminSection === 'teams'"
      :team-profiles="teamProfiles"
      :teams-total="teamsTotal"
      :teams-loading="teamsLoading"
      :teams-error="teamsError"
      :teams-message="teamsMessage"
      :teams-search="teamsSearch"
      :saving-team-profile="savingTeamProfile"
      :deleting-team-profile-id="deletingTeamProfileId"
      :force-delete-team-profile="forceDeleteTeamProfile"
      :is-global-admin="canUseGlobalFeatures"
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
      v-if="!isViewForbidden && adminSection === 'ingestion'"
      :can-run-sync="canRunIngestionSync"
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
      :latest-matches="paginatedMatches"
      :match-search="matchesSearch"
      :match-stage="matchesStageFilter"
      :match-stage-options="matchStageOptions"
      :current-page="matchesPage"
      :total-pages="matchesTotalPages"
      :total-matches="filteredMatches.length"
      :showing-start="matchesShowingStart"
      :showing-end="matchesShowingEnd"
      :match-score-draft-by-id="matchScoreDraftById"
      :saving-match-score-id="savingMatchScoreId"
      :match-score-message="matchScoreMessage"
      :match-score-error="matchScoreError"
      @run-fixtures-sync="runFixturesSync"
      @run-teams-sync="runTeamsSync"
      @update:match-search="matchesSearch = $event"
      @update:match-stage="matchesStageFilter = $event"
      @go-to-page="goToMatchesPage"
      @update-match-score-draft="updateMatchScoreDraft"
      @save-match-score="saveMatchScore"
      @update:force-sync="forceSync = $event"
    />
  </section>
</template>
