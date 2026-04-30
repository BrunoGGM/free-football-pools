<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

import {
  normalizeTeamKey,
  resolveTeamCode,
  teamFlagEmojiFromCode,
} from "~/utils/teamMeta";
import "flag-icons/css/flag-icons.min.css";

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
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  points_earned: number;
  created_at: string | null;
  hasPrediction: boolean;
  match: MatchRow | null;
}

interface RawPredictionRow {
  id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  points_earned: number | null;
  created_at: string | null;
  match: MatchRow | MatchRow[] | null;
}

interface AchievementItem {
  code: string;
  name: string;
  icon: string;
  unlockedAt: string;
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
const showExactHitCelebration = ref(false);
const exactHitDelta = ref(0);
let exactHitTimer: ReturnType<typeof setTimeout> | null = null;
const exactHitsInitialized = ref(false);
const exactHitsCount = ref(0);
const correctOutcomePoints = ref(1);
const exactScoreBonusPoints = ref(3);
const showStatsPanel = ref(true);
const picksSectionRef = ref<HTMLElement | null>(null);

const username = computed(() => {
  const metadataName = user.value?.user_metadata?.username;

  if (typeof metadataName === "string" && metadataName.length > 0) {
    return metadataName;
  }

  const email = user.value?.email;
  return email ? email.split("@")[0] : "Jugador";
});

const hasMatches = computed(() => predictions.value.length > 0);
const isLeader = computed(() => myRank.value === 1 && totalMembers.value > 0);
const totalMatchesCount = computed(() => predictions.value.length);

const predictionsMadeCount = computed(
  () => predictions.value.filter((row) => row.hasPrediction).length,
);

const finishedPredictionsCount = computed(
  () =>
    predictions.value.filter(
      (row) =>
        row.hasPrediction &&
        row.match?.status === "finished" &&
        row.match.home_score !== null &&
        row.match.away_score !== null,
    ).length,
);

const wonPredictionsCount = computed(
  () =>
    predictions.value.filter((row) => {
      if (
        !row.hasPrediction ||
        row.home_score === null ||
        row.away_score === null ||
        row.match?.status !== "finished" ||
        row.match.home_score === null ||
        row.match.away_score === null
      ) {
        return false;
      }

      return (
        resolveOutcome(row.home_score, row.away_score) ===
        resolveOutcome(row.match.home_score, row.match.away_score)
      );
    }).length,
);

const lostPredictionsCount = computed(() =>
  Math.max(0, finishedPredictionsCount.value - wonPredictionsCount.value),
);

const exactPredictionsCount = computed(
  () =>
    predictions.value.filter((row) => {
      if (
        !row.hasPrediction ||
        row.home_score === null ||
        row.away_score === null ||
        row.match?.status !== "finished" ||
        row.match.home_score === null ||
        row.match.away_score === null
      ) {
        return false;
      }

      return (
        row.home_score === row.match.home_score &&
        row.away_score === row.match.away_score
      );
    }).length,
);

const exactPointsEarnedTotal = computed(() =>
  predictions.value.reduce((total, row) => {
    if (
      !row.hasPrediction ||
      row.home_score === null ||
      row.away_score === null ||
      row.match?.status !== "finished" ||
      row.match.home_score === null ||
      row.match.away_score === null ||
      row.home_score !== row.match.home_score ||
      row.away_score !== row.match.away_score
    ) {
      return total;
    }

    return total + Number(row.points_earned ?? 0);
  }, 0),
);

const pickOutcomePointsTotal = computed(() =>
  predictions.value.reduce((total, row) => {
    if (
      !row.hasPrediction ||
      row.home_score === null ||
      row.away_score === null ||
      row.match?.status !== "finished" ||
      row.match.home_score === null ||
      row.match.away_score === null
    ) {
      return total;
    }

    const points = Number(row.points_earned ?? 0);
    const isExact =
      row.home_score === row.match.home_score &&
      row.away_score === row.match.away_score;
    const isOutcomeHit =
      resolveOutcome(row.home_score, row.away_score) ===
      resolveOutcome(row.match.home_score, row.match.away_score);

    if (!isOutcomeHit || points <= 0) {
      return total;
    }

    if (isExact) {
      return total + Math.min(points, Math.max(0, correctOutcomePoints.value));
    }

    return total + points;
  }, 0),
);

const exactBonusPointsTotal = computed(() =>
  predictions.value.reduce((total, row) => {
    if (
      !row.hasPrediction ||
      row.home_score === null ||
      row.away_score === null ||
      row.match?.status !== "finished" ||
      row.match.home_score === null ||
      row.match.away_score === null
    ) {
      return total;
    }

    const isExact =
      row.home_score === row.match.home_score &&
      row.away_score === row.match.away_score;

    if (!isExact) {
      return total;
    }

    const points = Number(row.points_earned ?? 0);
    const outcomePart = Math.min(
      points,
      Math.max(0, correctOutcomePoints.value),
    );
    const bonusPart = Math.max(0, points - outcomePart);

    return total + bonusPart;
  }, 0),
);

const pendingResolutionCount = computed(
  () =>
    predictions.value.filter(
      (row) => row.hasPrediction && row.match?.status !== "finished",
    ).length,
);

const missingPredictionsCount = computed(
  () => predictions.value.filter((row) => !row.hasPrediction).length,
);

const completionRate = computed(() => {
  if (totalMatchesCount.value <= 0) {
    return 0;
  }

  return Math.round(
    (predictionsMadeCount.value / totalMatchesCount.value) * 100,
  );
});

const accuracyRate = computed(() => {
  if (finishedPredictionsCount.value <= 0) {
    return 0;
  }

  return Math.round(
    (wonPredictionsCount.value / finishedPredictionsCount.value) * 100,
  );
});

const predictionsProgressText = computed(() => {
  if (totalMatchesCount.value <= 0) {
    return "0/0";
  }

  return `${predictionsMadeCount.value}/${totalMatchesCount.value}`;
});

const goToPicks = () => {
  if (!process.client) {
    return;
  }

  if (showStatsPanel.value) {
    showStatsPanel.value = false;
  }

  requestAnimationFrame(() => {
    picksSectionRef.value?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
};

const goToStats = () => {
  showStatsPanel.value = true;

  if (!process.client) {
    return;
  }

  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
};

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

const predictedChampionLogoUrl = computed(() => {
  if (!predictedChampion.value) {
    return null;
  }

  const championKey = normalizeTeamKey(predictedChampion.value);

  if (!championKey) {
    return null;
  }

  for (const row of predictions.value) {
    const match = row.match;

    if (!match) {
      continue;
    }

    if (
      normalizeTeamKey(match.home_team) === championKey &&
      match.home_team_logo_url
    ) {
      return match.home_team_logo_url;
    }

    if (
      normalizeTeamKey(match.away_team) === championKey &&
      match.away_team_logo_url
    ) {
      return match.away_team_logo_url;
    }
  }

  return null;
});

const flagIconClassFromCode = (code: string | null | undefined) => {
  const normalized = (code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `fi fi-${normalized}` : null;
};

const teamFlagIconClass = (code: string | null, team: string) => {
  const resolvedCode = code || resolveTeamCode(team);
  return flagIconClassFromCode(resolvedCode);
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

const isMissingScoringRulesError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("quiniela_rules") ||
    message.includes("correct_outcome_points") ||
    message.includes("exact_score_points")
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
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  compatibilityMessage.value = null;

  const rulesPromise = client
    .from("quiniela_rules")
    .select("correct_outcome_points, exact_score_points")
    .eq("quiniela_id", activeQuinielaId.value)
    .maybeSingle();

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

  const allMatchesPromise = client
    .from("matches")
    .select(
      "id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url",
    )
    .order("match_time", { ascending: true });

  const scopedPredictionsPromise = client
    .from("predictions")
    .select(
      "id, match_id, home_score, away_score, points_earned, created_at, match:matches(id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url)",
    )
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value)
    .order("match_time", { ascending: true, referencedTable: "matches" });

  const legacyPredictionsPromise = client
    .from("predictions")
    .select(
      "id, match_id, home_score, away_score, points_earned, created_at, match:matches(id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url)",
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

  const rulesResult = await rulesPromise;

  if (rulesResult.error) {
    correctOutcomePoints.value = 1;
    exactScoreBonusPoints.value = 3;

    if (isMissingScoringRulesError(rulesResult.error)) {
      appendCompatibilityMessage(
        "Reglas configurables no disponibles aun. Se asume +1 por pick acertado y +3 por exacto.",
      );
    } else {
      appendCompatibilityMessage(
        "No se pudieron cargar reglas de puntuacion; se usa +1 por pick y +3 por exacto.",
      );
    }
  } else {
    correctOutcomePoints.value = Math.max(
      0,
      Number(rulesResult.data?.correct_outcome_points ?? 1),
    );
    exactScoreBonusPoints.value = Math.max(
      0,
      Number(rulesResult.data?.exact_score_points ?? 3),
    );
  }

  const allMatchesResult = await allMatchesPromise;

  if (allMatchesResult.error) {
    errorMessage.value = allMatchesResult.error.message;
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

  const normalizedPredictions = (
    (predictionsResult.data as RawPredictionRow[] | null) ?? []
  ).map((row) => ({
    ...row,
    match: Array.isArray(row.match) ? (row.match[0] ?? null) : row.match,
  }));

  const predictionByMatchId = new Map<
    string,
    RawPredictionRow & { match: MatchRow | null }
  >();

  for (const row of normalizedPredictions) {
    const matchId = row.match_id || row.match?.id;

    if (!matchId) {
      continue;
    }

    predictionByMatchId.set(matchId, row);
  }

  const orderedMatches = (
    (allMatchesResult.data as MatchRow[] | null) ?? []
  ).slice();

  predictions.value = orderedMatches.map((match) => {
    const prediction = predictionByMatchId.get(match.id);

    if (!prediction) {
      return {
        id: `missing-${match.id}`,
        match_id: match.id,
        home_score: null,
        away_score: null,
        points_earned: 0,
        created_at: null,
        hasPrediction: false,
        match,
      };
    }

    const homeScore =
      prediction.home_score === null ? null : Number(prediction.home_score);
    const awayScore =
      prediction.away_score === null ? null : Number(prediction.away_score);

    return {
      id: prediction.id,
      match_id: match.id,
      home_score: homeScore,
      away_score: awayScore,
      points_earned: Number(prediction.points_earned ?? 0),
      created_at: prediction.created_at,
      hasPrediction: homeScore !== null && awayScore !== null,
      match,
    };
  });

  try {
    await loadGamificationSnapshot();
  } catch (error: any) {
    errorMessage.value = error?.message || "No se pudo cargar la gamificacion.";
  }

  const nextExactHits = predictions.value.filter((row) => {
    if (
      !row.hasPrediction ||
      row.home_score === null ||
      row.away_score === null ||
      row.match?.status !== "finished" ||
      row.match.home_score === null ||
      row.match.away_score === null
    ) {
      return false;
    }

    return (
      row.home_score === row.match.home_score &&
      row.away_score === row.match.away_score
    );
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
      :subtitle="`+${exactHitDelta * 4} pts en exactos confirmados`"
    />

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      No tienes una quiniela activa para mostrar tus respuestas.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-else
      class="rounded-2xl border border-info/35 bg-info/10 px-4 py-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-info/80 text-xs uppercase tracking-[0.14em]">Vista</p>
          <p class="text-base-content text-sm">
            Aqui puedes ver tus stats y tambien tus picks por partido.
          </p>
        </div>

        <div class="join">
          <button
            class="btn btn-sm join-item"
            :class="showStatsPanel ? 'btn-primary' : 'btn-outline'"
            @click="goToStats"
          >
            Ver stats
          </button>
          <button
            class="btn btn-sm join-item"
            :class="!showStatsPanel ? 'btn-primary' : 'btn-outline'"
            @click="goToPicks"
          >
            Ver picks
          </button>
        </div>
      </div>
    </article>

    <article
      v-if="activeQuinielaId && showStatsPanel"
      class="pitch-panel card neon-border rounded-3xl border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <p class="text-primary text-xs uppercase tracking-[0.18em]">
        Resumen personal
      </p>
      <h2 class="text-base-content mt-2 text-3xl sm:text-4xl">
        {{ username }}
      </h2>
      <div class="mt-2 flex items-center gap-3 text-sm">
        <img
          v-if="quiniela?.logo_url"
          :src="quiniela.logo_url"
          :alt="`Logo de ${quiniela.name}`"
          class="h-10 w-10 rounded-lg border border-base-300 bg-base-100 object-contain p-1"
        />
        <p class="text-base-content/70">
          Quiniela activa: {{ quiniela?.name || "Sin nombre" }}
        </p>
      </div>
      <p class="text-base-content/70 mt-2 text-xs">
        Regla: +{{ correctOutcomePoints }} por acertar pick
        (local/empate/visita) y +{{ exactScoreBonusPoints }} por marcador
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
            <span
              v-if="predictedChampion"
              class="inline-flex items-center gap-2"
            >
              <img
                v-if="predictedChampionLogoUrl"
                :src="predictedChampionLogoUrl"
                :alt="`Escudo de ${predictedChampion}`"
                class="h-5 w-5 rounded-full border border-base-300 object-cover"
                loading="lazy"
              />
              <span
                v-else-if="teamFlagIconClass(null, predictedChampion)"
                :class="teamFlagIconClass(null, predictedChampion) || undefined"
                class="inline-block h-4 w-5 rounded-[999px]"
                :title="`Bandera de ${predictedChampion}`"
                aria-hidden="true"
              />
              <span v-else>{{ teamFlag(null, predictedChampion) }}</span>
              <span>{{ predictedChampion }}</span>
            </span>
            <span v-else>No definido</span>
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <div
            class="tooltip tooltip-bottom"
            data-tip="La racha es la cantidad maxima de picks consecutivos acertados en partidos finalizados."
          >
            <p
              class="text-base-content/70 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em]"
            >
              Racha maxima
              <span class="badge badge-ghost badge-xs">i</span>
            </p>
          </div>
          <p class="text-success mt-1 text-3xl font-bold">
            {{ bestStreak }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            Racha actual: {{ currentStreak }}
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
          <p class="text-base-content/60 mt-1 text-xs">
            Racha evolutiva: 3, 5 y 10 aciertos consecutivos.
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Predicciones cargadas
          </p>
          <p class="text-info mt-1 text-3xl font-bold">
            {{ predictionsProgressText }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            {{ completionRate }}% del calendario actual
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Predicciones ganadas
          </p>
          <p class="text-success mt-1 text-3xl font-bold">
            {{ wonPredictionsCount }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            {{ accuracyRate }}% de acierto en partidos cerrados
          </p>
          <p class="text-base-content/60 mt-1 text-xs">
            {{ pickOutcomePointsTotal }} pts por pick acertado
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Predicciones perdidas
          </p>
          <p class="text-error mt-1 text-3xl font-bold">
            {{ lostPredictionsCount }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            Sobre {{ finishedPredictionsCount }} partidos ya finalizados
          </p>
        </div>

        <div class="card rounded-2xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Marcadores exactos
          </p>
          <p class="text-warning mt-1 text-3xl font-bold">
            {{ exactPredictionsCount }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            {{ exactBonusPointsTotal }} pts bonus de exacto
          </p>
          <p class="text-base-content/60 mt-1 text-xs">
            {{ exactPointsEarnedTotal }} pts totales en exactos
          </p>
        </div>
      </div>

      <p class="text-base-content/70 mt-3 text-xs">
        Desglose cerrado: {{ pickOutcomePointsTotal }} pts pick +
        {{ exactBonusPointsTotal }} pts exacto.
      </p>

      <p class="text-base-content/70 mt-1 text-xs">
        En revision: {{ pendingResolutionCount }} pick(s) pendientes de cierre.
        Sin pick: {{ missingPredictionsCount }} partido(s).
      </p>

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

      <div class="mt-4 flex justify-end">
        <button class="btn btn-sm btn-outline" @click="goToPicks">
          Ir a mis picks
        </button>
      </div>
    </article>

    <section v-if="activeQuinielaId" ref="picksSectionRef" class="space-y-3">
      <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
              Picks
            </p>
            <h2 class="text-base-content mt-1 text-xl font-semibold">
              Tus picks por partido
            </h2>
          </div>

          <button class="btn btn-sm btn-ghost" @click="goToStats">
            Volver a stats
          </button>
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
      <article v-else-if="!hasMatches" class="alert rounded-2xl text-sm">
        Todavia no hay partidos programados.
      </article>
      <article v-else>
        <DashboardQuinielaPredictionsTable
          :rows="predictions"
          pick-header="Tu prediccion"
          show-prediction-explanation
          show-points-breakdown
          :correct-outcome-points="correctOutcomePoints"
          kickoff-date-style="medium"
          :resolve-team-display-name="(team) => (team || '').trim() || '-'"
        />
      </article>
    </section>
  </section>
</template>
