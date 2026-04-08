<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

interface RankingRow {
  user_id: string;
  username: string;
  total_points: number;
  rank: number;
  automatic_points: number;
  manual_points: number;
}

interface PredictionStatsRow {
  user_id: string;
  home_score: number;
  away_score: number;
  points_earned: number | null;
  created_at: string;
  match:
    | {
        id: string;
        status: "pending" | "in_progress" | "finished";
        match_time: string;
        stage: string;
        home_team: string;
        away_team: string;
        home_score: number | null;
        away_score: number | null;
      }
    | Array<{
        id: string;
        status: "pending" | "in_progress" | "finished";
        match_time: string;
        stage: string;
        home_team: string;
        away_team: string;
        home_score: number | null;
        away_score: number | null;
      }>
    | null;
}

interface WeeklyRow {
  week_start_date: string;
  user_id: string;
  weekly_points: number | null;
  exact_hits: number | null;
}

interface StreakRow {
  user_id: string;
  current_streak: number | null;
  best_streak: number | null;
}

interface FinishedMatchRow {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
}

interface DashboardMatchRow {
  id: string;
  status: "pending" | "in_progress" | "finished";
  stage: string;
  match_time: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
}

interface NormalizedPredictionRow {
  user_id: string;
  home_score: number;
  away_score: number;
  points_earned: number;
  created_at: string;
  match: {
    id: string;
    status: "pending" | "in_progress" | "finished";
    match_time: string;
    stage: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
  } | null;
}

interface StageHeatmapItem {
  stage: string;
  played: number;
  exact: number;
  outcome: number;
  miss: number;
  effectiveness: number;
}

interface TeamHeatmapItem {
  team: string;
  played: number;
  hits: number;
  exact: number;
  effectiveness: number;
}

interface RivalDecisiveItem {
  match_id: string;
  stage: string;
  kickoff: string;
  matchup: string;
  my_points: number;
  rival_points: number;
  diff: number;
}

const user = useSupabaseUser();
const client = useSupabaseClient<any>();
const { activeQuinielaId, quiniela, loadActiveQuiniela } = useActiveQuiniela();

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const compatibilityMessages = ref<string[]>([]);

const rankingRows = ref<RankingRow[]>([]);
const leaderboardLabels = ref<string[]>([]);
const leaderboardValues = ref<number[]>([]);
const weeklyLabels = ref<string[]>([]);
const weeklyAverageValues = ref<number[]>([]);
const weeklyTotalValues = ref<number[]>([]);
const distributionValues = ref<number[]>([0, 0, 0]);
const distributionOthers = ref(0);
const evolutionLabels = ref<string[]>([]);
const evolutionDailyValues = ref<number[]>([]);
const evolutionCumulativeValues = ref<number[]>([]);

const memberCount = ref(0);
const myRank = ref<number | null>(null);
const gapToLeader = ref<number>(0);
const myCurrentStreak = ref(0);
const globalBestStreak = ref(0);
const totalAchievements = ref(0);
const achievementMembers = ref(0);
const tournamentGoalsTotal = ref(0);
const tournamentDrawsTotal = ref(0);
const mostWinningTeam = ref<{ name: string; value: number } | null>(null);
const mostLosingTeam = ref<{ name: string; value: number } | null>(null);
const mostScoringTeam = ref<{ name: string; value: number } | null>(null);
const allPredictions = ref<NormalizedPredictionRow[]>([]);
const unresolvedPredictionsByUser = ref<Record<string, number>>({});
const exactScoreBonusPoints = ref(3);
const correctOutcomePoints = ref(1);
const exactScoreMaxPoints = ref(4);

const projectedTop1Chance = ref<number | null>(null);
const projectedTop3Chance = ref<number | null>(null);
const projectionRuns = ref(0);
const reachableLeaderScenario = ref<string>("-");

const rivalUserId = ref<string | null>(null);
const rivalComparisonSummary = ref<{
  rivalName: string;
  myWins: number;
  rivalWins: number;
  ties: number;
  totalDiff: number;
} | null>(null);
const rivalDecisiveMatches = ref<RivalDecisiveItem[]>([]);

const stageHeatmap = ref<StageHeatmapItem[]>([]);
const teamHeatmap = ref<TeamHeatmapItem[]>([]);
const liveMatches = ref<DashboardMatchRow[]>([]);
const upcomingMatches = ref<DashboardMatchRow[]>([]);

const statsKpis = computed(() => {
  const exactCount = distributionValues.value[0] ?? 0;
  const outcomeCount = distributionValues.value[1] ?? 0;
  const missesCount = distributionValues.value[2] ?? 0;

  const totalClassified = exactCount + outcomeCount + missesCount;
  const exactRate =
    totalClassified > 0 ? Math.round((exactCount / totalClassified) * 100) : 0;

  return [
    {
      label: "Jugadores",
      value: String(memberCount.value),
      hint: "Miembros activos en esta quiniela",
      tone: "info" as const,
    },
    {
      label: "Mi posicion",
      value: myRank.value ? `#${myRank.value}` : "-",
      hint: myRank.value ? "Ranking actualizado" : "Sin posicion aun",
      tone: "neutral" as const,
    },
    {
      label: "Brecha al lider",
      value: `${gapToLeader.value} pts`,
      hint: "Diferencia contra el primer lugar",
      tone:
        gapToLeader.value <= 3 ? ("success" as const) : ("warning" as const),
    },
    {
      label: "Exactos",
      value: `${exactRate}%`,
      hint: `${exactCount} picks exactos (${exactScoreMaxPoints.value} pts)`,
      tone: "success" as const,
    },
    {
      label: "En juego",
      value: String(liveMatches.value.length),
      hint: "Partidos actualmente en progreso",
      tone:
        liveMatches.value.length > 0
          ? ("warning" as const)
          : ("neutral" as const),
    },
    {
      label: "Proximos",
      value: String(upcomingMatches.value.length),
      hint: "Partidos pendientes por disputarse",
      tone: "info" as const,
    },
    {
      label: "Racha actual",
      value: String(myCurrentStreak.value),
      hint: "Tu seguidilla vigente",
      tone:
        myCurrentStreak.value >= 3
          ? ("success" as const)
          : ("neutral" as const),
    },
    {
      label: "Mejor racha global",
      value: String(globalBestStreak.value),
      hint: "Mayor racha registrada en la quiniela",
      tone: "warning" as const,
    },
    {
      label: "Logros desbloqueados",
      value: String(totalAchievements.value),
      hint: `${achievementMembers.value} jugador(es) con logros`,
      tone: "info" as const,
    },
  ];
});

const topRankingRows = computed(() => rankingRows.value.slice(0, 8));

const rivalOptions = computed(() => {
  return rankingRows.value.filter((row) => row.user_id !== user.value?.id);
});

const selectedRivalName = computed(() => {
  const rival = rivalOptions.value.find(
    (row) => row.user_id === rivalUserId.value,
  );
  return rival?.username || "Rival";
});

const projectionTop1Text = computed(() => {
  if (projectedTop1Chance.value === null) {
    return "-";
  }

  return `${projectedTop1Chance.value.toFixed(1)}%`;
});

const projectionTop3Text = computed(() => {
  if (projectedTop3Chance.value === null) {
    return "-";
  }

  return `${projectedTop3Chance.value.toFixed(1)}%`;
});

const stageLabel = (stage: string) => stage.replaceAll("_", " ").toUpperCase();

const resolveOutcome = (
  homeScore: number,
  awayScore: number,
): "home" | "away" | "draw" => {
  if (homeScore > awayScore) {
    return "home";
  }

  if (homeScore < awayScore) {
    return "away";
  }

  return "draw";
};

const sampleFromDistribution = (
  distribution: Array<{ value: number; weight: number }>,
) => {
  const totalWeight = distribution.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  const random = Math.random() * totalWeight;
  let cursor = 0;

  for (const item of distribution) {
    cursor += item.weight;

    if (random <= cursor) {
      return item.value;
    }
  }

  return distribution[distribution.length - 1]?.value ?? 0;
};

const tournamentInsights = computed(() => {
  return [
    {
      label: "Equipo mas ganador",
      value: mostWinningTeam.value?.name || "-",
      hint: mostWinningTeam.value
        ? `${mostWinningTeam.value.value} victoria(s)`
        : "Sin datos",
      tone: "success",
    },
    {
      label: "Equipo mas perdedor",
      value: mostLosingTeam.value?.name || "-",
      hint: mostLosingTeam.value
        ? `${mostLosingTeam.value.value} derrota(s)`
        : "Sin datos",
      tone: "danger",
    },
    {
      label: "Equipo mas goleador",
      value: mostScoringTeam.value?.name || "-",
      hint: mostScoringTeam.value
        ? `${mostScoringTeam.value.value} goles`
        : "Sin datos",
      tone: "warning",
    },
    {
      label: "Goles totales",
      value: String(tournamentGoalsTotal.value),
      hint: "En partidos finalizados",
      tone: "info",
    },
    {
      label: "Empates totales",
      value: String(tournamentDrawsTotal.value),
      hint: "Partidos con marcador igualado",
      tone: "neutral",
    },
  ];
});

const hasWeeklyData = computed(() => weeklyLabels.value.length > 0);
const hasEvolutionData = computed(() => evolutionLabels.value.length > 0);
const hasLeaderboardData = computed(() => leaderboardLabels.value.length > 0);
const hasDistributionData = computed(() => {
  return distributionValues.value.some((value) => value > 0);
});

const distributionSchemeText = computed(
  () => `${exactScoreMaxPoints.value}/${correctOutcomePoints.value}/0`,
);

const distributionLabels = computed(() => [
  `Exacto (${exactScoreMaxPoints.value})`,
  `Resultado (${correctOutcomePoints.value})`,
  "Sin acierto (0)",
]);

const distributionTitle = computed(
  () => `Distribucion de aciertos (${distributionSchemeText.value})`,
);

const clearStats = () => {
  rankingRows.value = [];
  leaderboardLabels.value = [];
  leaderboardValues.value = [];
  weeklyLabels.value = [];
  weeklyAverageValues.value = [];
  weeklyTotalValues.value = [];
  distributionValues.value = [0, 0, 0];
  distributionOthers.value = 0;
  evolutionLabels.value = [];
  evolutionDailyValues.value = [];
  evolutionCumulativeValues.value = [];
  memberCount.value = 0;
  myRank.value = null;
  gapToLeader.value = 0;
  myCurrentStreak.value = 0;
  globalBestStreak.value = 0;
  totalAchievements.value = 0;
  achievementMembers.value = 0;
  tournamentGoalsTotal.value = 0;
  tournamentDrawsTotal.value = 0;
  mostWinningTeam.value = null;
  mostLosingTeam.value = null;
  mostScoringTeam.value = null;
  allPredictions.value = [];
  unresolvedPredictionsByUser.value = {};
  exactScoreBonusPoints.value = 3;
  correctOutcomePoints.value = 1;
  exactScoreMaxPoints.value = 4;
  projectedTop1Chance.value = null;
  projectedTop3Chance.value = null;
  projectionRuns.value = 0;
  reachableLeaderScenario.value = "-";
  rivalUserId.value = null;
  rivalComparisonSummary.value = null;
  rivalDecisiveMatches.value = [];
  stageHeatmap.value = [];
  teamHeatmap.value = [];
  liveMatches.value = [];
  upcomingMatches.value = [];
};

const pickTopTeam = (source: Map<string, number>) => {
  let selectedName: string | null = null;
  let selectedValue = -1;

  for (const [name, value] of source.entries()) {
    if (
      value > selectedValue ||
      (value === selectedValue &&
        selectedName &&
        name.localeCompare(selectedName) < 0)
    ) {
      selectedName = name;
      selectedValue = value;
    }
  }

  if (!selectedName || selectedValue < 0) {
    return null;
  }

  return {
    name: selectedName,
    value: selectedValue,
  };
};

const appendCompatibilityMessage = (message: string) => {
  if (!compatibilityMessages.value.includes(message)) {
    compatibilityMessages.value.push(message);
  }
};

const isMissingTableError = (error: any, keywords: string[]) => {
  const message = String(error?.message || "").toLowerCase();

  if (error?.code === "42P01") {
    return true;
  }

  return keywords.some((keyword) => message.includes(keyword.toLowerCase()));
};

const formatDateLabel = (isoDate: string) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
};

const formatKickoff = (value: string) => {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const toWeekKey = (value: string) => {
  const date = new Date(value);
  const dayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOffset);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const loadRanking = async () => {
  if (!activeQuinielaId.value) {
    rankingRows.value = [];
    return;
  }

  const rankingResult = await client
    .from("quiniela_rankings")
    .select("user_id, total_points, rank, automatic_points, manual_points")
    .eq("quiniela_id", activeQuinielaId.value)
    .order("rank", { ascending: true })
    .order("total_points", { ascending: false });

  let normalizedRanking: Array<{
    user_id: string;
    total_points: number;
    rank: number;
    automatic_points: number;
    manual_points: number;
  }> = [];

  if (
    rankingResult.error &&
    isMissingTableError(rankingResult.error, ["quiniela_rankings"])
  ) {
    appendCompatibilityMessage(
      "Ranking materializado no disponible aun. Usando calculo legacy de quiniela_members.",
    );

    const legacyResult = await client
      .from("quiniela_members")
      .select("user_id, total_points")
      .eq("quiniela_id", activeQuinielaId.value)
      .order("total_points", { ascending: false });

    if (legacyResult.error) {
      throw legacyResult.error;
    }

    let previousPoints: number | null = null;
    let previousRank = 0;

    normalizedRanking = (
      (legacyResult.data as Array<{
        user_id: string;
        total_points: number | null;
      }> | null) ?? []
    ).map((item, index) => {
      const currentPoints = Number(item.total_points ?? 0);
      const rank =
        previousPoints !== null && currentPoints === previousPoints
          ? previousRank
          : index + 1;

      previousPoints = currentPoints;
      previousRank = rank;

      return {
        user_id: item.user_id,
        total_points: currentPoints,
        rank,
        automatic_points: currentPoints,
        manual_points: 0,
      };
    });
  } else if (rankingResult.error) {
    throw rankingResult.error;
  } else {
    normalizedRanking = (
      (rankingResult.data as Array<{
        user_id: string;
        total_points: number | null;
        rank: number | null;
        automatic_points: number | null;
        manual_points: number | null;
      }> | null) ?? []
    ).map((item, index) => ({
      user_id: item.user_id,
      total_points: Number(item.total_points ?? 0),
      rank: Number(item.rank ?? index + 1),
      automatic_points: Number(item.automatic_points ?? 0),
      manual_points: Number(item.manual_points ?? 0),
    }));
  }

  const userIds = [...new Set(normalizedRanking.map((item) => item.user_id))];
  const usernamesById = new Map<string, string>();

  if (userIds.length > 0) {
    const profilesResult = await client
      .from("profiles")
      .select("id, username")
      .in("id", userIds);

    if (profilesResult.error) {
      throw profilesResult.error;
    }

    for (const profile of profilesResult.data || []) {
      usernamesById.set(
        profile.id as string,
        (profile.username as string) || "Jugador",
      );
    }
  }

  rankingRows.value = normalizedRanking.map((item) => ({
    user_id: item.user_id,
    username: usernamesById.get(item.user_id) || "Jugador",
    total_points: item.total_points,
    rank: item.rank,
    automatic_points: item.automatic_points,
    manual_points: item.manual_points,
  }));

  leaderboardLabels.value = rankingRows.value
    .slice(0, 8)
    .map((item) => `#${item.rank} ${item.username}`);
  leaderboardValues.value = rankingRows.value
    .slice(0, 8)
    .map((item) => item.total_points);

  memberCount.value = rankingRows.value.length;

  const own = rankingRows.value.find((item) => item.user_id === user.value?.id);
  const leader = rankingRows.value[0];

  myRank.value = own?.rank ?? null;
  gapToLeader.value =
    own && leader ? Math.max(0, leader.total_points - own.total_points) : 0;
};

const loadPredictionDerivedStats = async () => {
  if (!activeQuinielaId.value) {
    allPredictions.value = [];
    unresolvedPredictionsByUser.value = {};
    distributionValues.value = [0, 0, 0];
    distributionOthers.value = 0;
    evolutionLabels.value = [];
    evolutionDailyValues.value = [];
    evolutionCumulativeValues.value = [];
    return [] as Array<{
      user_id: string;
      points_earned: number;
      match_time: string;
    }>;
  }

  const predictionsResult = await client
    .from("predictions")
    .select(
      "user_id, home_score, away_score, points_earned, created_at, match:matches(id, status, match_time, stage, home_team, away_team, home_score, away_score)",
    )
    .eq("quiniela_id", activeQuinielaId.value);

  if (predictionsResult.error) {
    throw predictionsResult.error;
  }

  const normalizedRows: NormalizedPredictionRow[] = (
    (predictionsResult.data as PredictionStatsRow[] | null) ?? []
  ).map((item) => ({
    user_id: item.user_id,
    home_score: Number(item.home_score ?? 0),
    away_score: Number(item.away_score ?? 0),
    points_earned: Number(item.points_earned ?? 0),
    created_at: item.created_at,
    match: Array.isArray(item.match) ? (item.match[0] ?? null) : item.match,
  }));

  allPredictions.value = normalizedRows;

  const unresolvedMap: Record<string, number> = {};

  for (const row of normalizedRows) {
    if (!row.match || row.match.status === "finished") {
      continue;
    }

    unresolvedMap[row.user_id] = (unresolvedMap[row.user_id] ?? 0) + 1;
  }

  unresolvedPredictionsByUser.value = unresolvedMap;

  const finishedRows = normalizedRows
    .filter(
      (item) =>
        item.match?.status === "finished" && Boolean(item.match?.match_time),
    )
    .map((item) => ({
      user_id: item.user_id,
      points_earned: item.points_earned,
      match_time: item.match?.match_time || item.created_at,
    }));

  let exactHits = 0;
  let outcomeHits = 0;
  let misses0 = 0;
  let others = 0;

  for (const row of finishedRows) {
    if (row.points_earned === exactScoreMaxPoints.value) {
      exactHits += 1;
      continue;
    }

    if (row.points_earned === correctOutcomePoints.value) {
      outcomeHits += 1;
      continue;
    }

    if (row.points_earned === 0) {
      misses0 += 1;
      continue;
    }

    others += 1;
  }

  distributionValues.value = [exactHits, outcomeHits, misses0];
  distributionOthers.value = others;

  if (others > 0) {
    appendCompatibilityMessage(
      `Se detectaron puntuaciones fuera de ${distributionSchemeText.value} por reglas personalizadas; el donut principal muestra solo esas tres categorias.`,
    );
  }

  const ownRows = finishedRows
    .filter((item) => item.user_id === user.value?.id)
    .sort(
      (a, b) =>
        new Date(a.match_time).getTime() - new Date(b.match_time).getTime(),
    );

  const pointsByDay = new Map<string, number>();

  for (const row of ownRows) {
    const dayKey = row.match_time.slice(0, 10);
    pointsByDay.set(dayKey, (pointsByDay.get(dayKey) ?? 0) + row.points_earned);
  }

  const orderedDays = [...pointsByDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const chartDays = orderedDays.slice(-18);
  let cumulative = 0;

  evolutionLabels.value = chartDays.map(([day]) =>
    new Date(`${day}T00:00:00.000Z`).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    }),
  );
  evolutionDailyValues.value = [];
  evolutionCumulativeValues.value = [];

  for (const [, points] of chartDays) {
    evolutionDailyValues.value.push(points);
    cumulative += points;
    evolutionCumulativeValues.value.push(cumulative);
  }

  return finishedRows;
};

const loadWeeklyStats = async (
  finishedRows: Array<{
    user_id: string;
    points_earned: number;
    match_time: string;
  }>,
) => {
  if (!activeQuinielaId.value) {
    weeklyLabels.value = [];
    weeklyAverageValues.value = [];
    weeklyTotalValues.value = [];
    return;
  }

  const weeklyResult = await client
    .from("quiniela_weekly_rankings")
    .select("week_start_date, user_id, weekly_points, exact_hits")
    .eq("quiniela_id", activeQuinielaId.value)
    .order("week_start_date", { ascending: true });

  const weeklyMap = new Map<
    string,
    { totalPoints: number; users: Set<string> }
  >();

  if (
    weeklyResult.error &&
    isMissingTableError(weeklyResult.error, ["quiniela_weekly_rankings"])
  ) {
    appendCompatibilityMessage(
      "Ranking semanal materializado no disponible aun. Usando agregacion semanal desde predictions.",
    );

    for (const row of finishedRows) {
      const weekKey = toWeekKey(row.match_time);
      const current = weeklyMap.get(weekKey) ?? {
        totalPoints: 0,
        users: new Set<string>(),
      };
      current.totalPoints += row.points_earned;
      current.users.add(row.user_id);
      weeklyMap.set(weekKey, current);
    }
  } else if (weeklyResult.error) {
    throw weeklyResult.error;
  } else {
    for (const row of (weeklyResult.data as WeeklyRow[] | null) ?? []) {
      const weekKey = row.week_start_date;
      const current = weeklyMap.get(weekKey) ?? {
        totalPoints: 0,
        users: new Set<string>(),
      };
      current.totalPoints += Number(row.weekly_points ?? 0);
      current.users.add(row.user_id);
      weeklyMap.set(weekKey, current);
    }
  }

  const orderedWeeks = [...weeklyMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const chartWeeks = orderedWeeks.slice(-12);

  weeklyLabels.value = chartWeeks.map(([week]) => formatDateLabel(week));
  weeklyTotalValues.value = chartWeeks.map(([, value]) => value.totalPoints);
  weeklyAverageValues.value = chartWeeks.map(([, value]) => {
    const divisor = Math.max(1, value.users.size);
    return Number((value.totalPoints / divisor).toFixed(2));
  });
};

const loadStreakStats = async () => {
  if (!activeQuinielaId.value) {
    myCurrentStreak.value = 0;
    globalBestStreak.value = 0;
    return;
  }

  const streakResult = await client
    .from("quiniela_member_streaks")
    .select("user_id, current_streak, best_streak")
    .eq("quiniela_id", activeQuinielaId.value);

  if (
    streakResult.error &&
    isMissingTableError(streakResult.error, ["quiniela_member_streaks"])
  ) {
    appendCompatibilityMessage(
      "Rachas no disponibles aun. Aplica migracion 0015 para este modulo.",
    );
    myCurrentStreak.value = 0;
    globalBestStreak.value = 0;
    return;
  }

  if (streakResult.error) {
    throw streakResult.error;
  }

  const rows = (streakResult.data as StreakRow[] | null) ?? [];

  const own = rows.find((row) => row.user_id === user.value?.id);
  myCurrentStreak.value = Number(own?.current_streak ?? 0);
  globalBestStreak.value = rows.reduce((max, row) => {
    return Math.max(max, Number(row.best_streak ?? 0));
  }, 0);
};

const loadAchievementStats = async () => {
  if (!activeQuinielaId.value) {
    totalAchievements.value = 0;
    achievementMembers.value = 0;
    return;
  }

  const achievementsResult = await client
    .from("user_achievements")
    .select("user_id")
    .eq("quiniela_id", activeQuinielaId.value);

  if (
    achievementsResult.error &&
    isMissingTableError(achievementsResult.error, ["user_achievements"])
  ) {
    appendCompatibilityMessage(
      "Logros no disponibles aun. Aplica migracion 0015 para habilitarlos.",
    );
    totalAchievements.value = 0;
    achievementMembers.value = 0;
  } else if (achievementsResult.error) {
    throw achievementsResult.error;
  } else {
    const rows =
      (achievementsResult.data as Array<{ user_id: string }> | null) ?? [];
    totalAchievements.value = rows.length;
    achievementMembers.value = new Set(rows.map((row) => row.user_id)).size;
  }
};

const loadRuleMaxPoints = async () => {
  if (!activeQuinielaId.value) {
    exactScoreBonusPoints.value = 3;
    correctOutcomePoints.value = 1;
    exactScoreMaxPoints.value = 4;
    return;
  }

  const rulesResult = await client
    .from("quiniela_rules")
    .select("exact_score_points, correct_outcome_points")
    .eq("quiniela_id", activeQuinielaId.value)
    .maybeSingle();

  if (
    rulesResult.error &&
    isMissingTableError(rulesResult.error, [
      "quiniela_rules",
      "exact_score_points",
    ])
  ) {
    exactScoreBonusPoints.value = 3;
    correctOutcomePoints.value = 1;
    exactScoreMaxPoints.value = 4;
    appendCompatibilityMessage(
      "Reglas configurables no disponibles aun. Se asume +1 por resultado y +3 por exacto (4 pts total).",
    );
    return;
  }

  if (rulesResult.error) {
    throw rulesResult.error;
  }

  exactScoreBonusPoints.value = Number(
    rulesResult.data?.exact_score_points ?? 3,
  );
  correctOutcomePoints.value = Number(
    rulesResult.data?.correct_outcome_points ?? 1,
  );
  exactScoreMaxPoints.value =
    exactScoreBonusPoints.value + correctOutcomePoints.value;
};

const loadProjectionStats = () => {
  const ownRow = rankingRows.value.find(
    (row) => row.user_id === user.value?.id,
  );

  if (!ownRow || rankingRows.value.length === 0) {
    projectedTop1Chance.value = null;
    projectedTop3Chance.value = null;
    projectionRuns.value = 0;
    reachableLeaderScenario.value = "-";
    return;
  }

  const remainingOwnPredictions =
    unresolvedPredictionsByUser.value[ownRow.user_id] ?? 0;
  const maxReachableGain =
    remainingOwnPredictions * Math.max(1, exactScoreMaxPoints.value);

  if (gapToLeader.value <= 0) {
    reachableLeaderScenario.value =
      "Ya estas en la cima. El objetivo ahora es sostener la ventaja en partidos pendientes.";
  } else if (remainingOwnPredictions === 0) {
    reachableLeaderScenario.value =
      "No tienes partidos pendientes para recortar la brecha actual.";
  } else if (gapToLeader.value > maxReachableGain) {
    reachableLeaderScenario.value = `Con ${remainingOwnPredictions} partido(s) pendientes, tu maximo teorico no alcanza la brecha de ${gapToLeader.value} pts.`;
  } else {
    const neededTie = gapToLeader.value;
    const neededPass = gapToLeader.value + 1;
    const avgPerMatchTie = (neededTie / remainingOwnPredictions).toFixed(2);
    reachableLeaderScenario.value = `Para empatar al lider necesitas ~${neededTie} pts (promedio ${avgPerMatchTie} por partido). Para superarlo: ${neededPass} pts.`;
  }

  const finishedPointsDistribution = new Map<number, number>();

  for (const row of allPredictions.value) {
    if (!row.match || row.match.status !== "finished") {
      continue;
    }

    finishedPointsDistribution.set(
      row.points_earned,
      (finishedPointsDistribution.get(row.points_earned) ?? 0) + 1,
    );
  }

  const distribution = [...finishedPointsDistribution.entries()].map(
    ([value, weight]) => ({
      value,
      weight,
    }),
  );

  if (distribution.length === 0) {
    distribution.push(
      { value: 0, weight: 6 },
      { value: 1, weight: 3 },
      { value: exactScoreMaxPoints.value, weight: 1 },
    );
  }

  const runs = 1400;
  let top1Accumulator = 0;
  let top3Accumulator = 0;

  for (let run = 0; run < runs; run += 1) {
    const totals = new Map<string, number>();

    for (const row of rankingRows.value) {
      totals.set(row.user_id, row.total_points);
    }

    for (const row of rankingRows.value) {
      const remaining = unresolvedPredictionsByUser.value[row.user_id] ?? 0;

      for (let index = 0; index < remaining; index += 1) {
        const sampled = sampleFromDistribution(distribution);
        totals.set(
          row.user_id,
          (totals.get(row.user_id) ?? row.total_points) + sampled,
        );
      }
    }

    const ownTotal = totals.get(ownRow.user_id) ?? ownRow.total_points;
    const allTotals = [...totals.values()];
    const maxTotal = Math.max(...allTotals);
    const topTieCount = allTotals.filter((value) => value === maxTotal).length;

    if (ownTotal === maxTotal && topTieCount > 0) {
      top1Accumulator += 1 / topTieCount;
    }

    const rank = 1 + allTotals.filter((value) => value > ownTotal).length;

    if (rank <= 3) {
      top3Accumulator += 1;
    }
  }

  projectionRuns.value = runs;
  projectedTop1Chance.value = (top1Accumulator / runs) * 100;
  projectedTop3Chance.value = (top3Accumulator / runs) * 100;
};

const loadRivalComparison = () => {
  const ownUserId = user.value?.id;

  if (!ownUserId || rankingRows.value.length === 0) {
    rivalComparisonSummary.value = null;
    rivalDecisiveMatches.value = [];
    return;
  }

  const validRivalIds = new Set(rivalOptions.value.map((item) => item.user_id));

  if (!rivalUserId.value || !validRivalIds.has(rivalUserId.value)) {
    rivalUserId.value = rivalOptions.value[0]?.user_id ?? null;
  }

  if (!rivalUserId.value) {
    rivalComparisonSummary.value = null;
    rivalDecisiveMatches.value = [];
    return;
  }

  const rivalryMap = new Map<
    string,
    {
      match: NormalizedPredictionRow["match"];
      my_points?: number;
      rival_points?: number;
    }
  >();

  for (const row of allPredictions.value) {
    if (!row.match || row.match.status !== "finished") {
      continue;
    }

    if (row.user_id !== ownUserId && row.user_id !== rivalUserId.value) {
      continue;
    }

    const current = rivalryMap.get(row.match.id) ?? {
      match: row.match,
    };

    if (row.user_id === ownUserId) {
      current.my_points = row.points_earned;
    } else {
      current.rival_points = row.points_earned;
    }

    rivalryMap.set(row.match.id, current);
  }

  let myWins = 0;
  let rivalWins = 0;
  let ties = 0;
  let totalDiff = 0;

  const decisive: RivalDecisiveItem[] = [];

  for (const [matchId, item] of rivalryMap.entries()) {
    if (
      item.my_points === undefined ||
      item.rival_points === undefined ||
      !item.match
    ) {
      continue;
    }

    const diff = item.my_points - item.rival_points;
    totalDiff += diff;

    if (diff > 0) {
      myWins += 1;
    } else if (diff < 0) {
      rivalWins += 1;
    } else {
      ties += 1;
    }

    decisive.push({
      match_id: matchId,
      stage: stageLabel(item.match.stage),
      kickoff: new Date(item.match.match_time).toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      matchup: `${item.match.home_team} vs ${item.match.away_team}`,
      my_points: item.my_points,
      rival_points: item.rival_points,
      diff,
    });
  }

  rivalComparisonSummary.value = {
    rivalName: selectedRivalName.value,
    myWins,
    rivalWins,
    ties,
    totalDiff,
  };

  rivalDecisiveMatches.value = decisive
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 8);
};

const loadHeatmaps = () => {
  const ownUserId = user.value?.id;

  if (!ownUserId) {
    stageHeatmap.value = [];
    teamHeatmap.value = [];
    return;
  }

  const ownFinished = allPredictions.value.filter(
    (row) =>
      row.user_id === ownUserId &&
      row.match?.status === "finished" &&
      row.match.home_score !== null &&
      row.match.away_score !== null,
  );

  const stageMap = new Map<
    string,
    { played: number; exact: number; outcome: number; miss: number }
  >();
  const teamMap = new Map<
    string,
    { played: number; hits: number; exact: number }
  >();

  for (const row of ownFinished) {
    if (
      !row.match ||
      row.match.home_score === null ||
      row.match.away_score === null
    ) {
      continue;
    }

    const isExact =
      row.home_score === row.match.home_score &&
      row.away_score === row.match.away_score;

    const predictedOutcome = resolveOutcome(row.home_score, row.away_score);
    const officialOutcome = resolveOutcome(
      row.match.home_score,
      row.match.away_score,
    );
    const isOutcomeHit = !isExact && predictedOutcome === officialOutcome;
    const isHit = isExact || isOutcomeHit;

    const stageStats = stageMap.get(row.match.stage) ?? {
      played: 0,
      exact: 0,
      outcome: 0,
      miss: 0,
    };
    stageStats.played += 1;
    if (isExact) {
      stageStats.exact += 1;
    } else if (isOutcomeHit) {
      stageStats.outcome += 1;
    } else {
      stageStats.miss += 1;
    }
    stageMap.set(row.match.stage, stageStats);

    for (const teamName of [row.match.home_team, row.match.away_team]) {
      const teamStats = teamMap.get(teamName) ?? {
        played: 0,
        hits: 0,
        exact: 0,
      };
      teamStats.played += 1;
      if (isHit) {
        teamStats.hits += 1;
      }
      if (isExact) {
        teamStats.exact += 1;
      }
      teamMap.set(teamName, teamStats);
    }
  }

  stageHeatmap.value = [...stageMap.entries()]
    .map(([stage, stats]) => ({
      stage,
      played: stats.played,
      exact: stats.exact,
      outcome: stats.outcome,
      miss: stats.miss,
      effectiveness:
        stats.played > 0
          ? Math.round(((stats.exact + stats.outcome) / stats.played) * 100)
          : 0,
    }))
    .sort((a, b) => b.played - a.played);

  teamHeatmap.value = [...teamMap.entries()]
    .map(([team, stats]) => ({
      team,
      played: stats.played,
      hits: stats.hits,
      exact: stats.exact,
      effectiveness:
        stats.played > 0 ? Math.round((stats.hits / stats.played) * 100) : 0,
    }))
    .sort((a, b) => b.effectiveness - a.effectiveness || b.played - a.played)
    .slice(0, 14);
};

const loadTournamentInsights = async () => {
  const result = await client
    .from("matches")
    .select("home_team, away_team, home_score, away_score")
    .eq("status", "finished");

  if (result.error) {
    throw result.error;
  }

  const finishedMatches = (
    (result.data as FinishedMatchRow[] | null) ?? []
  ).filter(
    (item) =>
      item.home_score !== null &&
      item.home_score !== undefined &&
      item.away_score !== null &&
      item.away_score !== undefined,
  );

  const winsByTeam = new Map<string, number>();
  const lossesByTeam = new Map<string, number>();
  const goalsByTeam = new Map<string, number>();

  let goalsTotal = 0;
  let drawsTotal = 0;

  for (const match of finishedMatches) {
    const homeGoals = Number(match.home_score ?? 0);
    const awayGoals = Number(match.away_score ?? 0);

    goalsTotal += homeGoals + awayGoals;

    goalsByTeam.set(
      match.home_team,
      (goalsByTeam.get(match.home_team) ?? 0) + homeGoals,
    );
    goalsByTeam.set(
      match.away_team,
      (goalsByTeam.get(match.away_team) ?? 0) + awayGoals,
    );

    if (homeGoals === awayGoals) {
      drawsTotal += 1;
      continue;
    }

    if (homeGoals > awayGoals) {
      winsByTeam.set(
        match.home_team,
        (winsByTeam.get(match.home_team) ?? 0) + 1,
      );
      lossesByTeam.set(
        match.away_team,
        (lossesByTeam.get(match.away_team) ?? 0) + 1,
      );
      continue;
    }

    winsByTeam.set(match.away_team, (winsByTeam.get(match.away_team) ?? 0) + 1);
    lossesByTeam.set(
      match.home_team,
      (lossesByTeam.get(match.home_team) ?? 0) + 1,
    );
  }

  tournamentGoalsTotal.value = goalsTotal;
  tournamentDrawsTotal.value = drawsTotal;
  mostWinningTeam.value = pickTopTeam(winsByTeam);
  mostLosingTeam.value = pickTopTeam(lossesByTeam);
  mostScoringTeam.value = pickTopTeam(goalsByTeam);
};

const loadMatchPulse = async () => {
  const [liveResult, upcomingResult] = await Promise.all([
    client
      .from("matches")
      .select(
        "id, status, stage, match_time, home_team, away_team, home_score, away_score",
      )
      .eq("status", "in_progress")
      .order("match_time", { ascending: true })
      .limit(6),
    client
      .from("matches")
      .select(
        "id, status, stage, match_time, home_team, away_team, home_score, away_score",
      )
      .eq("status", "pending")
      .order("match_time", { ascending: true })
      .limit(8),
  ]);

  if (liveResult.error) {
    throw liveResult.error;
  }

  if (upcomingResult.error) {
    throw upcomingResult.error;
  }

  liveMatches.value = (
    (liveResult.data as DashboardMatchRow[] | null) ?? []
  ).map((item) => ({
    ...item,
    home_score:
      item.home_score === null || item.home_score === undefined
        ? null
        : Number(item.home_score),
    away_score:
      item.away_score === null || item.away_score === undefined
        ? null
        : Number(item.away_score),
  }));

  upcomingMatches.value = (
    (upcomingResult.data as DashboardMatchRow[] | null) ?? []
  ).map((item) => ({
    ...item,
    home_score:
      item.home_score === null || item.home_score === undefined
        ? null
        : Number(item.home_score),
    away_score:
      item.away_score === null || item.away_score === undefined
        ? null
        : Number(item.away_score),
  }));
};

const loadStats = async () => {
  if (!user.value || !activeQuinielaId.value) {
    clearStats();
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  compatibilityMessages.value = [];

  try {
    await loadActiveQuiniela();
    await loadRanking();
    await loadRuleMaxPoints();
    const finishedRows = await loadPredictionDerivedStats();
    await loadWeeklyStats(finishedRows);
    await loadStreakStats();
    await loadAchievementStats();
    await loadTournamentInsights();
    await loadMatchPulse();
    loadProjectionStats();
    loadRivalComparison();
    loadHeatmaps();
  } catch (error: any) {
    errorMessage.value =
      error?.message || "No se pudieron cargar las estadisticas.";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void loadStats();
});

watch(
  () => activeQuinielaId.value,
  () => {
    void loadStats();
  },
);

watch(
  () => rivalUserId.value,
  () => {
    loadRivalComparison();
  },
);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Dashboard
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Estadisticas</h1>
        <p class="text-base-content/70 mt-1 text-sm">
          Vista visual de rendimiento de la quiniela activa.
        </p>
      </div>

      <button
        class="btn btn-outline btn-sm"
        :disabled="loading"
        @click="loadStats"
      >
        {{ loading ? "Actualizando..." : "Refrescar" }}
      </button>
    </header>

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Activa una quiniela para ver estadisticas.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold">
        Seleccionar quiniela
      </NuxtLink>
    </article>

    <article v-else-if="loading" class="alert rounded-2xl text-sm">
      Cargando estadisticas visuales...
    </article>

    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>

    <template v-else>
      <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Quiniela en analisis
          </p>
          <span class="badge badge-primary badge-sm">{{
            quiniela?.name || "Sin nombre"
          }}</span>
        </div>
      </article>

      <article
        v-if="compatibilityMessages.length"
        class="alert alert-warning rounded-2xl text-xs leading-relaxed"
      >
        <div>
          <p class="font-semibold">Compatibilidad parcial detectada:</p>
          <p>{{ compatibilityMessages.join(" ") }}</p>
        </div>
      </article>

      <StatsKpiStrip :items="statsKpis" />

      <div class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <h3
            class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            Pulso de partidos
          </h3>
          <div class="mt-3 grid gap-3 lg:grid-cols-2">
            <article
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-3"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-base-content text-xs font-semibold uppercase">
                  Partidos en juego
                </p>
                <span class="badge badge-warning badge-sm">
                  {{ liveMatches.length }}
                </span>
              </div>

              <div
                v-if="liveMatches.length"
                class="mt-2 max-h-52 space-y-2 overflow-auto"
              >
                <div
                  v-for="item in liveMatches"
                  :key="`live-${item.id}`"
                  class="rounded-lg border border-base-300 bg-base-100/70 px-2 py-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-base-content text-xs font-semibold">
                      {{ item.home_team }} vs {{ item.away_team }}
                    </p>
                    <span class="badge badge-warning badge-xs">LIVE</span>
                  </div>
                  <p class="mt-1 text-xs font-semibold text-warning">
                    {{ item.home_score ?? "-" }} - {{ item.away_score ?? "-" }}
                  </p>
                  <p class="text-base-content/70 text-[11px]">
                    {{ stageLabel(item.stage) }} ·
                    {{ formatKickoff(item.match_time) }}
                  </p>
                </div>
              </div>
              <p v-else class="text-base-content/70 mt-2 text-xs">
                Ahora no hay partidos en curso.
              </p>
            </article>

            <article
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-3"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-base-content text-xs font-semibold uppercase">
                  Proximos partidos
                </p>
                <span class="badge badge-info badge-sm">
                  {{ upcomingMatches.length }}
                </span>
              </div>

              <div
                v-if="upcomingMatches.length"
                class="mt-2 max-h-52 space-y-2 overflow-auto"
              >
                <div
                  v-for="item in upcomingMatches"
                  :key="`upcoming-${item.id}`"
                  class="rounded-lg border border-base-300 bg-base-100/70 px-2 py-2"
                >
                  <p class="text-base-content text-xs font-semibold">
                    {{ item.home_team }} vs {{ item.away_team }}
                  </p>
                  <p class="text-base-content/70 mt-1 text-[11px]">
                    {{ stageLabel(item.stage) }} ·
                    {{ formatKickoff(item.match_time) }}
                  </p>
                </div>
              </div>
              <p v-else class="text-base-content/70 mt-2 text-xs">
                No hay partidos pendientes por ahora.
              </p>
            </article>
          </div>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <h3
            class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            Top 5 del ranking
          </h3>
          <div class="mt-3 space-y-2">
            <div
              v-for="row in topRankingRows.slice(0, 5)"
              :key="`ranking-${row.user_id}`"
              class="flex items-center justify-between rounded-xl border border-base-300 bg-base-200/55 px-3 py-2 text-sm"
            >
              <p class="font-semibold">#{{ row.rank }} {{ row.username }}</p>
              <p class="text-warning font-bold">{{ row.total_points }} pts</p>
            </div>
            <p
              v-if="topRankingRows.length === 0"
              class="text-base-content/70 text-sm"
            >
              Sin ranking disponible.
            </p>
          </div>
        </article>
      </div>

      <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
        <h3
          class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
        >
          Insights del torneo
        </h3>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article
            v-for="item in tournamentInsights"
            :key="item.label"
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-3"
          >
            <p
              class="text-base-content/70 text-[11px] uppercase tracking-[0.12em]"
            >
              {{ item.label }}
            </p>
            <p class="text-base-content mt-1 text-sm font-semibold">
              {{ item.value }}
            </p>
            <p class="text-base-content/70 mt-1 text-xs">
              {{ item.hint }}
            </p>
          </article>
        </div>
      </article>

      <div class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <h3
            class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            Proyeccion de cierre
          </h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-3"
            >
              <p
                class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
              >
                Probabilidad Top 1
              </p>
              <p class="text-warning mt-1 text-2xl font-bold">
                {{ projectionTop1Text }}
              </p>
              <p class="text-base-content/70 mt-1 text-xs">
                Simulaciones: {{ projectionRuns || 0 }}
              </p>
            </div>
            <div
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-3"
            >
              <p
                class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
              >
                Probabilidad Top 3
              </p>
              <p class="text-primary mt-1 text-2xl font-bold">
                {{ projectionTop3Text }}
              </p>
              <p class="text-base-content/70 mt-1 text-xs">
                Basado en partidos pendientes
              </p>
            </div>
          </div>

          <p
            class="text-base-content/75 mt-3 rounded-xl border border-base-300 bg-base-200/55 px-3 py-2 text-sm"
          >
            {{ reachableLeaderScenario }}
          </p>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3
              class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
            >
              Comparador contra rival
            </h3>
            <select
              v-model="rivalUserId"
              class="select select-bordered select-xs w-full sm:w-60"
            >
              <option v-if="rivalOptions.length === 0" :value="null" disabled>
                Sin rivales disponibles
              </option>
              <option
                v-for="item in rivalOptions"
                :key="`rival-${item.user_id}`"
                :value="item.user_id"
              >
                {{ item.username }}
              </option>
            </select>
          </div>

          <div
            v-if="rivalComparisonSummary"
            class="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <div
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2 text-sm"
            >
              <p class="text-base-content/70 text-xs">Duelo directo</p>
              <p class="mt-1 font-semibold">
                {{ rivalComparisonSummary.myWins }} ganados /
                {{ rivalComparisonSummary.rivalWins }} perdidos
              </p>
              <p class="text-base-content/70 text-xs">
                {{ rivalComparisonSummary.ties }} empates
              </p>
            </div>

            <div
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2 text-sm"
            >
              <p class="text-base-content/70 text-xs">Saldo total</p>
              <p
                class="mt-1 font-semibold"
                :class="
                  rivalComparisonSummary.totalDiff >= 0
                    ? 'text-success'
                    : 'text-error'
                "
              >
                {{ rivalComparisonSummary.totalDiff >= 0 ? "+" : ""
                }}{{ rivalComparisonSummary.totalDiff }} pts
              </p>
              <p class="text-base-content/70 text-xs">
                vs {{ rivalComparisonSummary.rivalName }}
              </p>
            </div>
          </div>

          <div
            v-if="rivalDecisiveMatches.length"
            class="mt-3 max-h-40 space-y-2 overflow-auto"
          >
            <div
              v-for="item in rivalDecisiveMatches.slice(0, 5)"
              :key="`decisive-${item.match_id}`"
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
            >
              <p class="text-base-content text-xs font-semibold">
                {{ item.matchup }}
              </p>
              <p class="text-base-content/70 text-[11px]">
                {{ item.stage }} · {{ item.kickoff }}
              </p>
              <p class="mt-1 text-xs">
                Tu: {{ item.my_points }} · Rival: {{ item.rival_points }}
                <span :class="item.diff >= 0 ? 'text-success' : 'text-error'">
                  ({{ item.diff >= 0 ? "+" : "" }}{{ item.diff }})
                </span>
              </p>
            </div>
          </div>
        </article>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <h3
            class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            Heatmap por etapa (tu rendimiento)
          </h3>
          <div
            v-if="stageHeatmap.length"
            class="mt-3 grid gap-2 sm:grid-cols-2"
          >
            <div
              v-for="item in stageHeatmap"
              :key="`stage-heat-${item.stage}`"
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
            >
              <p class="text-base-content text-xs font-semibold">
                {{ stageLabel(item.stage) }}
              </p>
              <p class="text-primary mt-1 text-sm font-bold">
                {{ item.effectiveness }}%
              </p>
              <p class="text-base-content/70 text-[11px]">
                {{ item.exact }} exactos · {{ item.outcome }} resultado ·
                {{ item.miss }} fallos
              </p>
            </div>
          </div>
          <p v-else class="text-base-content/70 mt-3 text-sm">
            Sin partidos finalizados para construir heatmap por etapa.
          </p>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <h3
            class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            Heatmap por equipo (top)
          </h3>
          <div
            v-if="teamHeatmap.length"
            class="mt-3 max-h-64 space-y-2 overflow-auto"
          >
            <div
              v-for="item in teamHeatmap"
              :key="`team-heat-${item.team}`"
              class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-base-content text-sm font-semibold">
                  {{ item.team }}
                </p>
                <span
                  class="badge badge-sm"
                  :class="
                    item.effectiveness >= 60 ? 'badge-success' : 'badge-ghost'
                  "
                >
                  {{ item.effectiveness }}%
                </span>
              </div>
              <p class="text-base-content/70 mt-1 text-[11px]">
                {{ item.hits }}/{{ item.played }} aciertos ·
                {{ item.exact }} exactos
              </p>
            </div>
          </div>
          <p v-else class="text-base-content/70 mt-3 text-sm">
            Sin partidos finalizados para construir heatmap por equipo.
          </p>
        </article>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <ClientOnly>
          <StatsLineChart
            v-if="hasEvolutionData"
            title="Evolucion de puntos (tu progreso)"
            :labels="evolutionLabels"
            :datasets="[
              {
                label: 'Puntos por fecha',
                values: evolutionDailyValues,
                color: '#f97316',
                fill: true,
              },
              {
                label: 'Acumulado',
                values: evolutionCumulativeValues,
                color: '#a855f7',
              },
            ]"
          />
          <article
            v-else
            class="rounded-2xl border border-base-300 bg-base-100/70 p-4"
          >
            <h3
              class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
            >
              Evolucion de puntos (tu progreso)
            </h3>
            <p class="text-base-content/70 mt-3 text-sm">
              Aun no hay suficientes picks finalizados para mostrar tendencia.
            </p>
          </article>
        </ClientOnly>

        <ClientOnly>
          <StatsLineChart
            v-if="hasWeeklyData"
            title="Rendimiento semanal"
            :labels="weeklyLabels"
            :datasets="[
              {
                label: 'Promedio semanal',
                values: weeklyAverageValues,
                color: '#22c55e',
                fill: true,
              },
              {
                label: 'Puntos totales',
                values: weeklyTotalValues,
                color: '#0ea5e9',
              },
            ]"
          />
          <article
            v-else
            class="rounded-2xl border border-base-300 bg-base-100/70 p-4"
          >
            <h3
              class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
            >
              Rendimiento semanal
            </h3>
            <p class="text-base-content/70 mt-3 text-sm">
              Aun no hay datos suficientes para esta grafica.
            </p>
          </article>
        </ClientOnly>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <ClientOnly>
          <StatsBarChart
            v-if="hasLeaderboardData"
            title="Leaderboard de la quiniela"
            :labels="leaderboardLabels"
            :values="leaderboardValues"
            color="#f59e0b"
          />
          <article
            v-else
            class="rounded-2xl border border-base-300 bg-base-100/70 p-4"
          >
            <h3
              class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
            >
              Leaderboard de la quiniela
            </h3>
            <p class="text-base-content/70 mt-3 text-sm">
              Sin datos de ranking por ahora.
            </p>
          </article>
        </ClientOnly>

        <ClientOnly>
          <StatsDoughnutChart
            v-if="hasDistributionData"
            :title="distributionTitle"
            :labels="distributionLabels"
            :values="distributionValues"
            :colors="['#22c55e', '#0ea5e9', '#ef4444']"
          />
          <article
            v-else
            class="rounded-2xl border border-base-300 bg-base-100/70 p-4"
          >
            <h3
              class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
            >
              {{ distributionTitle }}
            </h3>
            <p class="text-base-content/70 mt-3 text-sm">
              No hay resultados finalizados para calcular distribucion.
            </p>
          </article>
        </ClientOnly>
      </div>

      <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
        <h3
          class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
        >
          Gamificacion de la quiniela
        </h3>
        <div class="mt-3 grid gap-2 sm:grid-cols-2">
          <div
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
          >
            <p class="text-base-content/70 text-xs">Tu racha actual</p>
            <p class="text-success text-xl font-bold">
              {{ myCurrentStreak }}
            </p>
          </div>
          <div
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
          >
            <p class="text-base-content/70 text-xs">Mejor racha global</p>
            <p class="text-warning text-xl font-bold">
              {{ globalBestStreak }}
            </p>
          </div>
          <div
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
          >
            <p class="text-base-content/70 text-xs">Logros desbloqueados</p>
            <p class="text-primary text-xl font-bold">
              {{ totalAchievements }}
            </p>
            <p class="text-base-content/70 text-xs">
              {{ achievementMembers }} jugador(es) con logros
            </p>
          </div>
        </div>

        <p
          v-if="distributionOthers > 0"
          class="mt-3 text-xs text-base-content/70"
        >
          Nota: hay {{ distributionOthers }} predicciones con puntajes
          personalizados fuera del esquema {{ distributionSchemeText }}.
        </p>
      </article>
    </template>
  </section>
</template>
