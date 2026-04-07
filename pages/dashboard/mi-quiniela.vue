<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

import { resolveTeamCode, teamFlagEmojiFromCode } from "~/utils/teamMeta";

interface MatchRow {
  id: string;
  stage: string;
  status: "pending" | "in_progress" | "finished";
  match_time: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_team_code: string | null;
  away_team_code: string | null;
  home_team_logo_url: string | null;
  away_team_logo_url: string | null;
}

interface PredictionRow {
  id: string;
  home_score: number;
  away_score: number;
  points_earned: number;
  created_at: string;
  match: MatchRow | null;
}

interface RawPredictionRow {
  id: string;
  home_score: number;
  away_score: number;
  points_earned: number;
  created_at: string;
  match: MatchRow | MatchRow[] | null;
}

interface AchievementItem {
  code: string;
  name: string;
  icon: string;
  unlockedAt: string;
}

interface MissionItem {
  code: string;
  name: string;
  description: string | null;
  periodStartDate: string;
  progressValue: number;
  targetValue: number;
  rewardPoints: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt: string | null;
  claimedAt: string | null;
}

const user = useSupabaseUser();
const client = useSupabaseClient<any>();
const { quiniela, activeQuinielaId, loadActiveQuiniela } = useActiveQuiniela();
const { emitExactHit } = useGameUx();
const predictionsByQuinielaSupported = useState<boolean | null>(
  "predictions-by-quiniela-supported",
  () => null,
);
const gamificationSupported = useState<boolean | null>(
  "gamification-supported",
  () => null,
);
const missionsSupported = useState<boolean | null>(
  "missions-supported",
  () => null,
);

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const compatibilityMessage = ref<string | null>(null);
const memberTotalPoints = ref(0);
const predictedChampion = ref<string | null>(null);
const predictions = ref<PredictionRow[]>([]);
const myRank = ref<number | null>(null);
const totalMembers = ref(0);
const pointsFromLeader = ref<number | null>(null);
const aheadSummary = ref<{ username: string; gap: number } | null>(null);
const chaserSummary = ref<{ username: string; gap: number } | null>(null);
const tiePeersCount = ref(0);
const tiePeersPreview = ref<string[]>([]);
const currentStreak = ref(0);
const bestStreak = ref(0);
const earnedBadges = ref<AchievementItem[]>([]);
const missions = ref<MissionItem[]>([]);
const missionsLoading = ref(false);
const missionsError = ref<string | null>(null);
const missionsMessage = ref<string | null>(null);
const claimingMissionCode = ref<string | null>(null);
const showExactHitCelebration = ref(false);
const exactHitDelta = ref(0);
let exactHitTimer: ReturnType<typeof setTimeout> | null = null;
const exactHitsInitialized = ref(false);
const exactHitsCount = ref(0);

const username = computed(() => {
  const metadataName = user.value?.user_metadata?.username;

  if (typeof metadataName === "string" && metadataName.length > 0) {
    return metadataName;
  }

  const email = user.value?.email;
  return email ? email.split("@")[0] : "Jugador";
});

const hasPredictions = computed(() => predictions.value.length > 0);
const isLeader = computed(() => myRank.value === 1 && totalMembers.value > 0);

const rankEmoji = computed(() => {
  if (myRank.value === 1) {
    return "👑";
  }

  if (myRank.value === 2) {
    return "🥈";
  }

  if (myRank.value === 3) {
    return "🥉";
  }

  return "🎯";
});

const rankPositionText = computed(() => {
  if (!myRank.value || totalMembers.value <= 0) {
    return "Sin posicion";
  }

  return `#${myRank.value} de ${totalMembers.value}`;
});

const leaderStatusText = computed(() => {
  if (!myRank.value || totalMembers.value <= 0) {
    return "Aun no tienes posicion en esta quiniela.";
  }

  if (isLeader.value && tiePeersCount.value > 0) {
    return `Vas empatado en 1er lugar con ${tiePeersCount.value} jugador${tiePeersCount.value === 1 ? "" : "es"}.`;
  }

  if (isLeader.value) {
    return "Vas en primer lugar: mantienes el premio completo.";
  }

  if (tiePeersCount.value > 0) {
    return `Estas empatado en el puesto #${myRank.value} con ${tiePeersCount.value} jugador${tiePeersCount.value === 1 ? "" : "es"}.`;
  }

  return `Estas a ${pointsFromLeader.value ?? 0} pts del lider.`;
});

const tiePeersText = computed(() => {
  if (tiePeersCount.value <= 0) {
    return "";
  }

  const preview = tiePeersPreview.value;
  const extra = tiePeersCount.value - preview.length;

  if (preview.length === 0) {
    return `Empate con ${tiePeersCount.value} jugador${tiePeersCount.value === 1 ? "" : "es"}.`;
  }

  if (extra > 0) {
    return `Empate con ${preview.join(", ")} y ${extra} mas.`;
  }

  return `Empate con ${preview.join(", ")}.`;
});

const aheadText = computed(() => {
  if (!myRank.value || totalMembers.value <= 0) {
    return "-";
  }

  if (isLeader.value) {
    return tiePeersCount.value > 0
      ? "Lider compartido."
      : "Nadie. Tu marcas el ritmo.";
  }

  if (!aheadSummary.value) {
    return tiePeersCount.value > 0 ? "Empate en tu puesto" : "Sin referencia";
  }

  return `${aheadSummary.value.username} (+${aheadSummary.value.gap} pts)`;
});

const chaserText = computed(() => {
  if (!myRank.value || totalMembers.value <= 0) {
    return "-";
  }

  if (!chaserSummary.value) {
    return "Nadie por detras.";
  }

  if (isLeader.value) {
    return `${chaserSummary.value.username} a ${chaserSummary.value.gap} pts`;
  }

  return `${chaserSummary.value.username} (${chaserSummary.value.gap} pts abajo)`;
});

const badgeCountText = computed(() => {
  const count = earnedBadges.value.length;
  return `${count} medalla${count === 1 ? "" : "s"}`;
});

const stageLabel = (stage: string) => stage.replaceAll("_", " ").toUpperCase();

const kickoffText = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const getCurrentWeekStartDate = () => {
  const today = new Date();
  const dayOffset = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - dayOffset);
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
};

const teamFlag = (code: string | null, team: string) => {
  const resolvedCode = code || resolveTeamCode(team);
  return teamFlagEmojiFromCode(resolvedCode);
};

const isMissingQuinielaColumnError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42703" ||
    message.includes("predictions.quiniela_id") ||
    (message.includes("column") && message.includes("quiniela_id"))
  );
};

const isMissingRankingTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    (message.includes("quiniela_rankings") && message.includes("exist"))
  );
};

const isMissingGamificationTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    message.includes("quiniela_member_streaks") ||
    message.includes("user_achievements") ||
    message.includes("achievement_definitions")
  );
};

const isMissingMissionsFeatureError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    message.includes("user_mission_progress") ||
    message.includes("quiniela_missions") ||
    message.includes("mission_definitions") ||
    message.includes("get_user_missions_snapshot") ||
    message.includes("claim_user_mission_reward")
  );
};

const appendCompatibilityMessage = (message: string) => {
  if (!compatibilityMessage.value) {
    compatibilityMessage.value = message;
    return;
  }

  if (!compatibilityMessage.value.includes(message)) {
    compatibilityMessage.value = `${compatibilityMessage.value} ${message}`;
  }
};

type MatchOutcome = "home" | "away" | "draw";

const resolveOutcome = (home: number, away: number): MatchOutcome => {
  if (home > away) {
    return "home";
  }

  if (home < away) {
    return "away";
  }

  return "draw";
};

const predictionText = (row: PredictionRow) => {
  if (!row.match) {
    return "Prediccion guardada";
  }

  if (row.home_score > row.away_score) {
    return `Gana ${row.match.home_team}`;
  }

  if (row.home_score < row.away_score) {
    return `Gana ${row.match.away_team}`;
  }

  return "Empate";
};

const officialResultText = (match: MatchRow | null) => {
  if (!match || match.home_score === null || match.away_score === null) {
    return "Sin resultado oficial";
  }

  if (match.home_score > match.away_score) {
    return `Gana ${match.home_team}`;
  }

  if (match.home_score < match.away_score) {
    return `Gana ${match.away_team}`;
  }

  return "Empate";
};

const outcomeLabel = (row: PredictionRow) => {
  if (!row.match) {
    return "Sin partido";
  }

  if (row.match.status === "in_progress") {
    return "En juego";
  }

  if (
    row.match.status !== "finished" ||
    row.match.home_score === null ||
    row.match.away_score === null
  ) {
    return "Pendiente";
  }

  const exactMatch =
    row.home_score === row.match.home_score &&
    row.away_score === row.match.away_score;

  if (exactMatch) {
    return "Marcador exacto (+3)";
  }

  const predictedOutcome = resolveOutcome(row.home_score, row.away_score);
  const officialOutcome = resolveOutcome(
    row.match.home_score,
    row.match.away_score,
  );

  if (predictedOutcome === officialOutcome) {
    return "Resultado acertado (+1)";
  }

  return "Sin acierto (0)";
};

const outcomeClass = (row: PredictionRow) => {
  if (!row.match || row.match.status === "pending") {
    return "badge-ghost";
  }

  if (row.match.status === "in_progress") {
    return "badge-warning";
  }

  if (row.match.home_score === null || row.match.away_score === null) {
    return "badge-ghost";
  }

  const exactMatch =
    row.home_score === row.match.home_score &&
    row.away_score === row.match.away_score;

  if (exactMatch) {
    return "badge-success";
  }

  const predictedOutcome = resolveOutcome(row.home_score, row.away_score);
  const officialOutcome = resolveOutcome(
    row.match.home_score,
    row.match.away_score,
  );

  if (predictedOutcome === officialOutcome) {
    return "badge-info";
  }

  return "badge-error";
};

const triggerExactHitCelebration = (delta: number, totalExactHits: number) => {
  if (exactHitTimer) {
    clearTimeout(exactHitTimer);
  }

  exactHitDelta.value = delta;
  showExactHitCelebration.value = true;
  emitExactHit({ delta, totalExactHits });

  exactHitTimer = setTimeout(() => {
    showExactHitCelebration.value = false;
  }, 2600);
};

const loadGamificationSnapshot = async () => {
  if (!user.value || !activeQuinielaId.value) {
    currentStreak.value = 0;
    bestStreak.value = 0;
    earnedBadges.value = [];
    return;
  }

  if (gamificationSupported.value === false) {
    currentStreak.value = 0;
    bestStreak.value = 0;
    earnedBadges.value = [];
    appendCompatibilityMessage(
      "Gamificacion no disponible aun. Aplica la migracion 0015 para rachas y medallas.",
    );
    return;
  }

  const streakResult = await client
    .from("quiniela_member_streaks")
    .select("current_streak, best_streak")
    .eq("quiniela_id", activeQuinielaId.value)
    .eq("user_id", user.value.id)
    .maybeSingle();

  if (streakResult.error) {
    if (isMissingGamificationTableError(streakResult.error)) {
      gamificationSupported.value = false;
      currentStreak.value = 0;
      bestStreak.value = 0;
      earnedBadges.value = [];
      appendCompatibilityMessage(
        "Gamificacion no disponible aun. Aplica la migracion 0015 para rachas y medallas.",
      );
      return;
    }

    throw streakResult.error;
  }

  const achievementsResult = await client
    .from("user_achievements")
    .select(
      "unlocked_at, achievement:achievement_definitions(code, name, icon_emoji)",
    )
    .eq("quiniela_id", activeQuinielaId.value)
    .eq("user_id", user.value.id)
    .order("unlocked_at", { ascending: false });

  if (achievementsResult.error) {
    if (isMissingGamificationTableError(achievementsResult.error)) {
      gamificationSupported.value = false;
      currentStreak.value = 0;
      bestStreak.value = 0;
      earnedBadges.value = [];
      appendCompatibilityMessage(
        "Gamificacion no disponible aun. Aplica la migracion 0015 para rachas y medallas.",
      );
      return;
    }

    throw achievementsResult.error;
  }

  gamificationSupported.value = true;
  currentStreak.value = Number(streakResult.data?.current_streak ?? 0);
  bestStreak.value = Number(streakResult.data?.best_streak ?? 0);

  earnedBadges.value = (
    (achievementsResult.data as Array<{
      unlocked_at: string;
      achievement:
        | {
            code?: string | null;
            name?: string | null;
            icon_emoji?: string | null;
          }
        | Array<{
            code?: string | null;
            name?: string | null;
            icon_emoji?: string | null;
          }>
        | null;
    }> | null) ?? []
  )
    .map((row) => {
      const rawAchievement = Array.isArray(row.achievement)
        ? row.achievement[0]
        : row.achievement;

      if (!rawAchievement) {
        return null;
      }

      return {
        code: rawAchievement.code || "badge",
        name: rawAchievement.name || "Medalla",
        icon: rawAchievement.icon_emoji || "🏅",
        unlockedAt: row.unlocked_at,
      };
    })
    .filter((row): row is AchievementItem => Boolean(row));
};

const loadMissionsSnapshot = async () => {
  if (!user.value || !activeQuinielaId.value) {
    missions.value = [];
    missionsError.value = null;
    missionsMessage.value = null;
    return;
  }

  missionsLoading.value = true;
  missionsError.value = null;

  if (missionsSupported.value === false) {
    missions.value = [];
    appendCompatibilityMessage(
      "Misiones semanales no disponibles aun. Aplica la migracion 0018 para habilitarlas.",
    );
    missionsLoading.value = false;
    return;
  }

  const weekStartDate = getCurrentWeekStartDate();
  const result = await client.rpc("get_user_missions_snapshot", {
    p_user_id: user.value.id,
    p_quiniela_id: activeQuinielaId.value,
    p_period_start_date: weekStartDate,
  });

  missionsLoading.value = false;

  if (result.error) {
    if (isMissingMissionsFeatureError(result.error)) {
      missionsSupported.value = false;
      missions.value = [];
      appendCompatibilityMessage(
        "Misiones semanales no disponibles aun. Aplica la migracion 0018 para habilitarlas.",
      );
      return;
    }

    missionsError.value =
      result.error.message || "No se pudo cargar el progreso de misiones.";
    return;
  }

  missionsSupported.value = true;
  missions.value = (
    (result.data as Array<{
      mission_code: string;
      mission_name: string;
      mission_description: string | null;
      period_start_date: string;
      progress_value: number | null;
      target_value: number | null;
      reward_points: number | null;
      is_completed: boolean | null;
      is_claimed: boolean | null;
      completed_at: string | null;
      claimed_at: string | null;
    }> | null) ?? []
  )
    .map((item) => ({
      code: item.mission_code,
      name: item.mission_name,
      description: item.mission_description,
      periodStartDate: item.period_start_date,
      progressValue: Number(item.progress_value ?? 0),
      targetValue: Number(item.target_value ?? 0),
      rewardPoints: Number(item.reward_points ?? 0),
      isCompleted: Boolean(item.is_completed),
      isClaimed: Boolean(item.is_claimed),
      completedAt: item.completed_at,
      claimedAt: item.claimed_at,
    }))
    .sort((a, b) => a.targetValue - b.targetValue);
};

const claimMissionReward = async (mission: MissionItem) => {
  if (!user.value || !activeQuinielaId.value) {
    return;
  }

  if (!mission.isCompleted || mission.isClaimed) {
    return;
  }

  missionsError.value = null;
  missionsMessage.value = null;
  claimingMissionCode.value = mission.code;

  const result = await client.rpc("claim_user_mission_reward", {
    p_quiniela_id: activeQuinielaId.value,
    p_mission_code: mission.code,
    p_period_start_date: mission.periodStartDate,
  });

  if (result.error) {
    if (isMissingMissionsFeatureError(result.error)) {
      missionsSupported.value = false;
      appendCompatibilityMessage(
        "Misiones semanales no disponibles aun. Aplica la migracion 0018 para habilitarlas.",
      );
      claimingMissionCode.value = null;
      return;
    }

    missionsError.value =
      result.error.message || "No se pudo reclamar la recompensa.";
    claimingMissionCode.value = null;
    return;
  }

  const response = (result.data || {}) as {
    message?: string;
    pointsAwarded?: number;
  };

  missionsMessage.value =
    response.message ||
    `Recompensa reclamada. +${Number(response.pointsAwarded ?? 0)} pts`;

  claimingMissionCode.value = null;
  await loadMyQuinielaView();
};

const loadMyQuinielaView = async () => {
  if (!user.value || !activeQuinielaId.value) {
    predictions.value = [];
    memberTotalPoints.value = 0;
    predictedChampion.value = null;
    myRank.value = null;
    totalMembers.value = 0;
    pointsFromLeader.value = null;
    aheadSummary.value = null;
    chaserSummary.value = null;
    tiePeersCount.value = 0;
    tiePeersPreview.value = [];
    currentStreak.value = 0;
    bestStreak.value = 0;
    earnedBadges.value = [];
    missions.value = [];
    missionsError.value = null;
    missionsMessage.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  compatibilityMessage.value = null;

  const memberPromise = client
    .from("quiniela_members")
    .select("total_points, predicted_champion")
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value)
    .maybeSingle();

  const rankingMembersPromise = client
    .from("quiniela_rankings")
    .select("user_id, total_points, rank")
    .eq("quiniela_id", activeQuinielaId.value)
    .order("rank", { ascending: true })
    .order("total_points", { ascending: false });

  const scopedPredictionsPromise = client
    .from("predictions")
    .select(
      "id, home_score, away_score, points_earned, created_at, match:matches(id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url)",
    )
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value)
    .order("match_time", { ascending: true, referencedTable: "matches" });

  const legacyPredictionsPromise = client
    .from("predictions")
    .select(
      "id, home_score, away_score, points_earned, created_at, match:matches(id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url)",
    )
    .eq("user_id", user.value.id)
    .order("match_time", { ascending: true, referencedTable: "matches" });

  const memberResult = await memberPromise;
  let predictionsResult: any;

  if (predictionsByQuinielaSupported.value === false) {
    predictionsResult = await legacyPredictionsPromise;
    compatibilityMessage.value =
      "Tu base de datos aun no tiene soporte por quiniela en predicciones. Aplica la migracion 0012 para separar completamente por quiniela.";
  } else {
    const scopedResult = await scopedPredictionsPromise;

    if (
      scopedResult.error &&
      isMissingQuinielaColumnError(scopedResult.error)
    ) {
      predictionsByQuinielaSupported.value = false;
      predictionsResult = await legacyPredictionsPromise;
      compatibilityMessage.value =
        "Tu base de datos aun no tiene soporte por quiniela en predicciones. Aplica la migracion 0012 para separar completamente por quiniela.";
    } else {
      predictionsByQuinielaSupported.value = true;
      predictionsResult = scopedResult;
    }
  }

  loading.value = false;

  if (memberResult.error) {
    errorMessage.value = memberResult.error.message;
    return;
  }

  if (predictionsResult.error) {
    errorMessage.value = predictionsResult.error.message;
    return;
  }

  memberTotalPoints.value = Number(memberResult.data?.total_points ?? 0);
  predictedChampion.value =
    (memberResult.data?.predicted_champion as string | null) ?? null;

  const rankingMembersResult = await rankingMembersPromise;
  let rankingRows: Array<{
    user_id: string;
    total_points: number;
    rank: number;
  }> = [];

  if (rankingMembersResult.error) {
    if (isMissingRankingTableError(rankingMembersResult.error)) {
      compatibilityMessage.value =
        "Ranking precomputado no disponible aun. Aplica la migracion 0014 para mejorar rendimiento y empates.";

      const { data: legacyMembers, error: legacyMembersError } = await client
        .from("quiniela_members")
        .select("user_id, total_points")
        .eq("quiniela_id", activeQuinielaId.value)
        .order("total_points", { ascending: false });

      if (!legacyMembersError) {
        let previousPoints: number | null = null;
        let previousRank = 0;

        rankingRows = (
          (legacyMembers as Array<{
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
          };
        });
      }
    }
  } else {
    rankingRows = (
      (rankingMembersResult.data as Array<{
        user_id: string;
        total_points: number | null;
        rank: number;
      }> | null) ?? []
    ).map((item) => ({
      user_id: item.user_id,
      total_points: Number(item.total_points ?? 0),
      rank: Number(item.rank || 0),
    }));
  }

  if (rankingRows.length > 0) {
    const rankingUserIds = [
      ...new Set(rankingRows.map((item) => item.user_id)),
    ];

    const profileMap = new Map<string, { username: string }>();

    if (rankingUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await client
        .from("profiles")
        .select("id, username")
        .in("id", rankingUserIds);

      if (!profilesError) {
        for (const profile of profiles ?? []) {
          profileMap.set(profile.id as string, {
            username: (profile.username as string) ?? "Jugador",
          });
        }
      }
    }

    const ranking = rankingRows.map((item) => ({
      ...item,
      username:
        profileMap.get(item.user_id)?.username ??
        (item.user_id === user.value?.id ? username.value : "Jugador"),
    }));

    totalMembers.value = ranking.length;

    const ownIndex = ranking.findIndex(
      (item) => item.user_id === user.value?.id,
    );

    if (ownIndex >= 0) {
      const own = ranking[ownIndex]!;
      const leaderPointsValue = ranking[0]?.total_points ?? own.total_points;

      myRank.value = own.rank;
      pointsFromLeader.value = Math.max(
        0,
        leaderPointsValue - own.total_points,
      );

      const ahead =
        ranking
          .slice(0, ownIndex)
          .reverse()
          .find((item) => item.total_points > own.total_points) ?? null;
      const chaser =
        ranking
          .slice(ownIndex + 1)
          .find((item) => item.total_points < own.total_points) ?? null;
      const tiePeers = ranking.filter(
        (item) =>
          item.user_id !== own.user_id &&
          item.total_points === own.total_points,
      );

      aheadSummary.value = ahead
        ? {
            username: ahead.username ?? "Jugador",
            gap: Math.max(0, ahead.total_points - own.total_points),
          }
        : null;

      chaserSummary.value = chaser
        ? {
            username: chaser.username ?? "Jugador",
            gap: Math.max(0, own.total_points - chaser.total_points),
          }
        : null;

      tiePeersCount.value = tiePeers.length;
      tiePeersPreview.value = tiePeers
        .slice(0, 2)
        .map((item) => item.username ?? "Jugador");

      memberTotalPoints.value = own.total_points;
    } else {
      myRank.value = null;
      pointsFromLeader.value = null;
      aheadSummary.value = null;
      chaserSummary.value = null;
      tiePeersCount.value = 0;
      tiePeersPreview.value = [];
    }
  } else {
    myRank.value = null;
    totalMembers.value = 0;
    pointsFromLeader.value = null;
    aheadSummary.value = null;
    chaserSummary.value = null;
    tiePeersCount.value = 0;
    tiePeersPreview.value = [];
  }

  const normalized = (
    (predictionsResult.data as RawPredictionRow[] | null) ?? []
  )
    .map((row) => ({
      ...row,
      match: Array.isArray(row.match) ? (row.match[0] ?? null) : row.match,
    }))
    .filter((row) => Boolean(row.match))
    .sort((a, b) => {
      const aTime = a.match ? new Date(a.match.match_time).getTime() : 0;
      const bTime = b.match ? new Date(b.match.match_time).getTime() : 0;
      return bTime - aTime;
    });

  predictions.value = normalized;

  try {
    await loadGamificationSnapshot();
  } catch (error: any) {
    errorMessage.value = error?.message || "No se pudo cargar la gamificacion.";
  }

  await loadMissionsSnapshot();

  const nextExactHits = normalized.filter((row) => {
    return row.match?.status === "finished" && Number(row.points_earned) >= 3;
  }).length;

  if (!exactHitsInitialized.value) {
    exactHitsCount.value = nextExactHits;
    exactHitsInitialized.value = true;
    return;
  }

  if (nextExactHits > exactHitsCount.value) {
    triggerExactHitCelebration(
      nextExactHits - exactHitsCount.value,
      nextExactHits,
    );
  }

  exactHitsCount.value = nextExactHits;
};

onMounted(async () => {
  await loadActiveQuiniela();
  await loadMyQuinielaView();
});

watch(
  () => activeQuinielaId.value,
  () => {
    showExactHitCelebration.value = false;
    exactHitsInitialized.value = false;
    exactHitsCount.value = 0;
    missionsMessage.value = null;
    missionsError.value = null;
    void loadMyQuinielaView();
  },
);

onBeforeUnmount(() => {
  if (exactHitTimer) {
    clearTimeout(exactHitTimer);
  }
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Dashboard
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Mi quiniela</h1>
      </div>
      <button class="btn btn-outline btn-sm" @click="loadMyQuinielaView">
        Refrescar
      </button>
    </header>

    <WowSaveBurst
      :visible="showExactHitCelebration"
      class="mt-1"
      :title="exactHitDelta > 1 ? 'Exactos encadenados' : 'Marcador exacto'"
      :subtitle="`+${exactHitDelta * 3} pts en exactos confirmados`"
    />

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      No tienes una quiniela activa para mostrar tus respuestas.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-else
      class="pitch-panel card neon-border rounded-3xl border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <p class="text-primary text-xs uppercase tracking-[0.18em]">
        Resumen personal
      </p>
      <h2 class="text-base-content mt-2 text-3xl sm:text-4xl">
        {{ username }}
      </h2>
      <p class="text-base-content/70 mt-2 text-sm">
        Quiniela activa: {{ quiniela?.name || "Sin nombre" }}
      </p>
      <p class="text-base-content/70 mt-2 text-xs">
        Regla: +1 por acertar resultado (local/empate/visita) y +3 por marcador
        exacto.
      </p>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Puntos totales
          </p>
          <p class="text-warning mt-1 text-3xl font-bold">
            {{ memberTotalPoints }}
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Campeon predicho
          </p>
          <p class="text-primary mt-1 text-lg font-semibold">
            {{ predictedChampion || "No definido" }}
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Racha actual
          </p>
          <p class="text-success mt-1 text-3xl font-bold">
            {{ currentStreak }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            Mejor racha: {{ bestStreak }}
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Medallas
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="badge in earnedBadges.slice(0, 4)"
              :key="`${badge.code}-${badge.unlockedAt}`"
              class="badge badge-sm badge-outline"
            >
              {{ badge.icon }} {{ badge.name }}
            </span>
            <span
              v-if="earnedBadges.length === 0"
              class="text-base-content/70 text-xs"
            >
              Sin medallas por ahora.
            </span>
          </div>
          <p class="text-base-content/70 mt-2 text-xs">
            {{ badgeCountText }} desbloqueadas
          </p>
        </div>
      </div>

      <div
        v-if="myRank"
        :class="[
          'mt-5 rounded-2xl border p-4',
          isLeader
            ? 'leader-podium border-warning/35'
            : 'border-base-300 bg-base-100/70',
        ]"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
              Tu lugar actual
            </p>
            <h3
              :class="[
                'mt-1 text-2xl font-bold',
                isLeader ? 'leader-points' : 'text-primary',
              ]"
            >
              {{ rankPositionText }}
            </h3>
            <p
              :class="[
                'mt-1 text-sm',
                isLeader ? 'leader-jackpot' : 'text-base-content/75',
              ]"
            >
              {{ leaderStatusText }}
            </p>
            <p
              v-if="tiePeersCount > 0"
              class="text-base-content/70 mt-1 text-xs"
            >
              {{ tiePeersText }}
            </p>
          </div>
          <span :class="['text-3xl', isLeader && 'leader-crown']">{{
            rankEmoji
          }}</span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
          >
            <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
              Delante de ti
            </p>
            <p class="mt-1 text-sm font-semibold">{{ aheadText }}</p>
          </div>
          <div
            class="rounded-xl border border-base-300 bg-base-200/55 px-3 py-2"
          >
            <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
              Te persigue
            </p>
            <p class="mt-1 text-sm font-semibold">{{ chaserText }}</p>
          </div>
        </div>
      </div>

      <p
        v-if="compatibilityMessage"
        class="alert alert-warning mt-4 rounded-xl px-3 py-2 text-xs"
      >
        {{ compatibilityMessage }}
      </p>
    </article>

    <article
      v-if="activeQuinielaId && missionsSupported !== false"
      class="rounded-2xl border border-base-300 bg-base-100/70 p-5"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-primary text-xs uppercase tracking-[0.18em]">
            Misiones
          </p>
          <h2 class="text-base-content mt-1 text-xl">Pre-jornada semanal</h2>
        </div>
        <button
          class="btn btn-outline btn-xs"
          :disabled="missionsLoading"
          @click="loadMissionsSnapshot"
        >
          {{ missionsLoading ? "Cargando..." : "Refrescar" }}
        </button>
      </div>

      <p class="text-base-content/70 mt-2 text-xs">
        Completa predicciones antes del silbatazo para desbloquear puntos extra.
      </p>

      <p v-if="missionsMessage" class="alert alert-success mt-3 text-xs">
        {{ missionsMessage }}
      </p>

      <p v-if="missionsError" class="alert alert-error mt-3 text-xs">
        {{ missionsError }}
      </p>

      <div v-if="missionsLoading" class="mt-4 text-sm text-base-content/70">
        Cargando misiones de la semana...
      </div>

      <div
        v-else-if="missions.length === 0"
        class="mt-4 text-sm text-base-content/70"
      >
        No hay misiones activas para esta quiniela.
      </div>

      <div v-else class="mt-4 grid gap-3 md:grid-cols-2">
        <div
          v-for="mission in missions"
          :key="`${mission.code}-${mission.periodStartDate}`"
          class="rounded-xl border border-base-300 bg-base-200/55 p-4"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold text-base-content">
                {{ mission.name }}
              </p>
              <p class="mt-1 text-xs text-base-content/70">
                {{ mission.description || "Mision semanal" }}
              </p>
            </div>
            <span class="badge badge-sm badge-primary">
              +{{ mission.rewardPoints }} pts
            </span>
          </div>

          <div class="mt-3">
            <progress
              class="progress progress-primary h-2 w-full"
              :max="mission.targetValue"
              :value="Math.min(mission.progressValue, mission.targetValue)"
            />
            <p class="mt-1 text-xs text-base-content/70">
              {{ mission.progressValue }}/{{ mission.targetValue }} completado
            </p>
          </div>

          <div class="mt-3 flex items-center justify-between gap-2">
            <span v-if="mission.isClaimed" class="badge badge-success badge-sm">
              Reclamada
            </span>
            <span
              v-else-if="mission.isCompleted"
              class="badge badge-warning badge-sm"
            >
              Lista para reclamar
            </span>
            <span v-else class="badge badge-ghost badge-sm">En progreso</span>

            <button
              class="btn btn-primary btn-xs"
              :disabled="
                !mission.isCompleted ||
                mission.isClaimed ||
                claimingMissionCode === mission.code
              "
              @click="claimMissionReward(mission)"
            >
              {{
                claimingMissionCode === mission.code
                  ? "Reclamando..."
                  : mission.isClaimed
                    ? "Reclamada"
                    : "Reclamar"
              }}
            </button>
          </div>
        </div>
      </div>
    </article>

    <article v-if="loading" class="alert rounded-2xl text-sm">
      Cargando tus predicciones...
    </article>
    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>
    <article v-else-if="!hasPredictions" class="alert rounded-2xl text-sm">
      Todavia no has guardado predicciones.
    </article>
    <article
      v-else
      class="overflow-x-auto rounded-2xl border border-base-300 bg-base-100/70"
    >
      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
        >
          <tr>
            <th class="px-4 py-3">Partido</th>
            <th class="px-4 py-3">Tu prediccion</th>
            <th class="px-4 py-3">Resultado</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Puntos</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in predictions"
            :key="row.id"
            class="border-t border-base-300 align-top"
          >
            <td class="px-4 py-3">
              <p class="text-base-content/70 text-xs">
                {{ row.match ? stageLabel(row.match.stage) : "-" }}
              </p>
              <div class="mt-1 flex items-center gap-2">
                <img
                  v-if="row.match?.home_team_logo_url"
                  :src="row.match.home_team_logo_url"
                  :alt="`Escudo de ${row.match.home_team}`"
                  class="h-5 w-5 rounded-full border border-base-300 object-cover"
                  loading="lazy"
                />
                <span v-else class="text-base">
                  {{
                    row.match
                      ? teamFlag(row.match.home_team_code, row.match.home_team)
                      : ""
                  }}
                </span>
                <span>{{ row.match?.home_team }}</span>
                <span class="text-base-content/70">vs</span>
                <img
                  v-if="row.match?.away_team_logo_url"
                  :src="row.match.away_team_logo_url"
                  :alt="`Escudo de ${row.match.away_team}`"
                  class="h-5 w-5 rounded-full border border-base-300 object-cover"
                  loading="lazy"
                />
                <span v-else class="text-base">
                  {{
                    row.match
                      ? teamFlag(row.match.away_team_code, row.match.away_team)
                      : ""
                  }}
                </span>
                <span>{{ row.match?.away_team }}</span>
              </div>
              <p class="text-base-content/70 mt-1 text-xs">
                {{ row.match ? kickoffText(row.match.match_time) : "-" }}
              </p>
            </td>
            <td class="px-4 py-3 font-semibold">
              <p>{{ row.home_score }} : {{ row.away_score }}</p>
              <p class="text-base-content/70 mt-1 text-xs font-normal">
                {{ predictionText(row) }}
              </p>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="
                  row.match?.home_score !== null &&
                  row.match?.away_score !== null
                "
              >
                {{ row.match?.home_score }} : {{ row.match?.away_score }}
              </span>
              <span v-else class="text-base-content/70">Pendiente</span>
              <p
                class="text-base-content/70 mt-1 text-xs"
                v-if="
                  row.match?.home_score !== null &&
                  row.match?.away_score !== null
                "
              >
                {{ officialResultText(row.match) }}
              </p>
            </td>
            <td class="px-4 py-3">
              <span
                class="badge badge-sm px-3 py-1 text-xs font-semibold"
                :class="outcomeClass(row)"
              >
                {{ outcomeLabel(row) }}
              </span>
            </td>
            <td class="text-warning px-4 py-3 font-semibold">
              {{ row.points_earned }}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>
