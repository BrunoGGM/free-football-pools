<script setup lang="ts">
import {
  normalizeTeamKey,
  resolveTeamCode,
  teamFlagEmojiFromCode,
} from "~/utils/teamMeta";

definePageMeta({
  middleware: ["auth"],
});

interface PositionRow {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  predicted_champion: string | null;
  current_streak: number;
  badge_icons: string[];
}

interface TeamProfileOption {
  name: string;
  code: string | null;
  logo_url: string | null;
  team_key: string;
}

interface WeeklyLeaderRow {
  user_id: string;
  username: string;
  weekly_points: number;
  exact_hits: number;
}

const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const { emitChampionSaved, emitRankUp } = useGameUx();
const activeQuinielaId = useCookie<string | null>("active_quiniela_id");
const { quiniela, loadActiveQuiniela } = useActiveQuiniela();
const gamificationSupported = useState<boolean | null>(
  "gamification-supported",
  () => null,
);
const weeklyRankingSupported = useState<boolean | null>(
  "weekly-ranking-supported",
  () => null,
);

const rows = ref<PositionRow[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const championInput = ref("");
const championPickerOpen = ref(false);
const championInputRef = ref<HTMLInputElement | null>(null);
const championDropdownStyle = ref<Record<string, string>>({});
const savingChampion = ref(false);
const championSaved = ref(false);
let championSaveTimer: ReturnType<typeof setTimeout> | null = null;
const rankUpVisible = ref(false);
const rankUpFrom = ref<number | null>(null);
const rankUpTo = ref<number | null>(null);
let rankUpTimer: ReturnType<typeof setTimeout> | null = null;
const previousOwnRank = ref<number | null>(null);
const registeredTeams = ref<TeamProfileOption[]>([]);
const gamificationMessage = ref<string | null>(null);
const weeklyLeaders = ref<WeeklyLeaderRow[]>([]);

const rankUpSubtitle = computed(() => {
  if (!rankUpFrom.value || !rankUpTo.value) {
    return "Sigues escalando la tabla";
  }

  const climbed = Math.max(1, rankUpFrom.value - rankUpTo.value);
  return `Subiste ${climbed} puesto${climbed === 1 ? "" : "s"}`;
});

const registeredTeamsMap = computed(() => {
  const map = new Map<string, TeamProfileOption>();

  for (const team of registeredTeams.value) {
    map.set(normalizeTeamKey(team.name), team);
    map.set(team.team_key, team);
  }

  return map;
});

const championOptions = computed(() => {
  const query = normalizeTeamKey(championInput.value.trim());

  if (!query) {
    return registeredTeams.value.slice(0, 12);
  }

  return registeredTeams.value
    .filter((team) => {
      const byName = normalizeTeamKey(team.name);
      return byName.includes(query) || team.team_key.includes(query);
    })
    .slice(0, 12);
});

const selectedChampionInfo = computed(() =>
  getChampionInfo(championInput.value.trim() || null),
);

const leaderRow = computed(() => rows.value[0] ?? null);
const topTieCount = computed(() => {
  const topPoints = rows.value[0]?.total_points;

  if (topPoints === undefined) {
    return 0;
  }

  return rows.value.filter((row) => row.total_points === topPoints).length;
});

const leaderTitle = computed(() =>
  topTieCount.value > 1 ? "Lideres del torneo" : "Lider del torneo",
);

const leaderName = computed(() => {
  if (!leaderRow.value) {
    return "";
  }

  if (topTieCount.value <= 1) {
    return leaderRow.value.username;
  }

  const others = topTieCount.value - 1;
  return `${leaderRow.value.username} y ${others} mas`;
});

const leaderGapText = computed(() => {
  if (rows.value.length < 2) {
    return "Sin perseguidores por ahora";
  }

  const leader = rows.value[0];
  const runnerUp = rows.value[1];
  const gap =
    Number(leader?.total_points ?? 0) - Number(runnerUp?.total_points ?? 0);

  if (gap <= 0) {
    return "Empate en la cima";
  }

  return `+${gap} pts sobre el 2do lugar`;
});

const medalByRank = (rank: number) => {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return "";
};

const firstPlacePrize = computed(() => {
  const ticketPrice = Number(quiniela.value?.ticket_price ?? 0);
  return ticketPrice * rows.value.length;
});

const firstPlacePrizeText = computed(() => {
  return firstPlacePrize.value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
});

const getCurrentWeekStartDate = () => {
  const today = new Date();
  const dayOffset = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - dayOffset);
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
};

const weeklyPeriodText = computed(() => {
  const since = new Date(`${getCurrentWeekStartDate()}T00:00:00.000Z`);
  return since.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
});

const resolveChampionFromRegisteredTeams = (input: string) => {
  const raw = input.trim();

  if (!raw) {
    return {
      matched: true,
      name: null as string | null,
    };
  }

  const normalized = normalizeTeamKey(raw);
  const exact = registeredTeamsMap.value.get(normalized);

  if (exact) {
    return {
      matched: true,
      name: exact.name,
    };
  }

  const startsWith = registeredTeams.value.filter((team) =>
    normalizeTeamKey(team.name).startsWith(normalized),
  );

  const firstMatch = startsWith.at(0);

  if (startsWith.length === 1 && firstMatch) {
    return {
      matched: true,
      name: firstMatch.name,
    };
  }

  return {
    matched: false,
    name: raw,
  };
};

const getChampionInfo = (value: string | null) => {
  if (!value) {
    return null;
  }

  const exact = registeredTeamsMap.value.get(normalizeTeamKey(value));

  if (exact) {
    return {
      name: exact.name,
      code: exact.code,
      logoUrl: exact.logo_url,
    };
  }

  return {
    name: value,
    code: resolveTeamCode(value),
    logoUrl: null,
  };
};

const championFlag = (value: string | null) => {
  const info = getChampionInfo(value);
  return info ? teamFlagEmojiFromCode(info.code) : "";
};

const championDisplayName = (value: string | null) => {
  const info = getChampionInfo(value);
  return info?.name ?? "-";
};

const championLogoUrl = (value: string | null) => {
  const info = getChampionInfo(value);
  return info?.logoUrl ?? null;
};

const teamOptionFlag = (team: TeamProfileOption) =>
  teamFlagEmojiFromCode(team.code || resolveTeamCode(team.name));

const selectChampionFromList = (team: TeamProfileOption) => {
  championInput.value = team.name;
  championPickerOpen.value = false;
};

const onChampionInputBlur = () => {
  setTimeout(() => {
    championPickerOpen.value = false;
  }, 120);
};

const updateChampionDropdownPosition = () => {
  if (!process.client || !championInputRef.value) {
    return;
  }

  const rect = championInputRef.value.getBoundingClientRect();

  championDropdownStyle.value = {
    position: "fixed",
    left: `${Math.max(8, rect.left)}px`,
    top: `${rect.bottom + 8}px`,
    width: `${rect.width}px`,
    zIndex: "1400",
  };
};

const onChampionDropdownViewportChange = () => {
  if (championPickerOpen.value) {
    updateChampionDropdownPosition();
  }
};

const triggerChampionCelebration = () => {
  if (championSaveTimer) {
    clearTimeout(championSaveTimer);
  }

  championSaved.value = true;
  emitChampionSaved();

  championSaveTimer = setTimeout(() => {
    championSaved.value = false;
  }, 2300);
};

const triggerRankUpCelebration = (fromRank: number, toRank: number) => {
  if (rankUpTimer) {
    clearTimeout(rankUpTimer);
  }

  rankUpFrom.value = fromRank;
  rankUpTo.value = toRank;
  rankUpVisible.value = true;
  emitRankUp({ fromRank, toRank });

  rankUpTimer = setTimeout(() => {
    rankUpVisible.value = false;
  }, 2600);
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

const isMissingWeeklyRankingTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    message.includes("quiniela_weekly_rankings") ||
    (message.includes("relation") && message.includes("weekly"))
  );
};

const appendGamificationMessage = (message: string) => {
  if (!gamificationMessage.value) {
    gamificationMessage.value = message;
    return;
  }

  if (!gamificationMessage.value.includes(message)) {
    gamificationMessage.value = `${gamificationMessage.value} ${message}`;
  }
};

const loadRanking = async () => {
  if (!activeQuinielaId.value) {
    rows.value = [];
    gamificationMessage.value = null;
    weeklyLeaders.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = null;
  gamificationMessage.value = null;
  weeklyLeaders.value = [];

  const rankingResult = await client
    .from("quiniela_rankings")
    .select("user_id, total_points, rank")
    .eq("quiniela_id", activeQuinielaId.value)
    .order("rank", { ascending: true })
    .order("total_points", { ascending: false });

  let rankingRows: Array<{
    user_id: string;
    total_points: number;
    rank: number;
  }> = [];

  if (rankingResult.error) {
    if (!isMissingRankingTableError(rankingResult.error)) {
      loading.value = false;
      errorMessage.value = rankingResult.error.message;
      return;
    }

    const { data: legacyMembers, error: legacyError } = await client
      .from("quiniela_members")
      .select("user_id, total_points")
      .eq("quiniela_id", activeQuinielaId.value)
      .order("total_points", { ascending: false });

    if (legacyError) {
      loading.value = false;
      errorMessage.value = legacyError.message;
      return;
    }

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
  } else {
    rankingRows = (
      (rankingResult.data as Array<{
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

  const userIds = [...new Set(rankingRows.map((item) => item.user_id))];
  const profilesMap = new Map<
    string,
    { username: string; avatar_url: string | null }
  >();
  const championsMap = new Map<string, string | null>();
  const streaksMap = new Map<string, number>();
  const badgesMap = new Map<string, string[]>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      loading.value = false;
      errorMessage.value = profilesError.message;
      return;
    }

    for (const profile of profiles ?? []) {
      profilesMap.set(profile.id as string, {
        username: (profile.username as string) ?? "Jugador",
        avatar_url: (profile.avatar_url as string | null) ?? null,
      });
    }
  }

  if (userIds.length > 0) {
    const { data: memberPicks, error: memberPicksError } = await client
      .from("quiniela_members")
      .select("user_id, predicted_champion")
      .eq("quiniela_id", activeQuinielaId.value)
      .in("user_id", userIds);

    if (memberPicksError) {
      loading.value = false;
      errorMessage.value = memberPicksError.message;
      return;
    }

    for (const member of memberPicks ?? []) {
      championsMap.set(
        member.user_id as string,
        (member.predicted_champion as string | null) ?? null,
      );
    }
  }

  if (userIds.length > 0 && gamificationSupported.value !== false) {
    const { data: streakRows, error: streakError } = await client
      .from("quiniela_member_streaks")
      .select("user_id, current_streak")
      .eq("quiniela_id", activeQuinielaId.value)
      .in("user_id", userIds);

    if (streakError && isMissingGamificationTableError(streakError)) {
      gamificationSupported.value = false;
      appendGamificationMessage(
        "Gamificacion no disponible aun. Aplica la migracion 0015 para rachas y medallas.",
      );
    } else if (streakError) {
      loading.value = false;
      errorMessage.value = streakError.message;
      return;
    } else {
      gamificationSupported.value = true;

      for (const row of streakRows ?? []) {
        streaksMap.set(
          row.user_id as string,
          Number((row as { current_streak?: number }).current_streak ?? 0),
        );
      }
    }
  }

  if (userIds.length > 0 && gamificationSupported.value !== false) {
    const { data: achievementRows, error: achievementsError } = await client
      .from("user_achievements")
      .select("user_id, achievement:achievement_definitions(icon_emoji)")
      .eq("quiniela_id", activeQuinielaId.value)
      .in("user_id", userIds)
      .order("unlocked_at", { ascending: false });

    if (
      achievementsError &&
      isMissingGamificationTableError(achievementsError)
    ) {
      gamificationSupported.value = false;
      appendGamificationMessage(
        "Gamificacion no disponible aun. Aplica la migracion 0015 para rachas y medallas.",
      );
    } else if (achievementsError) {
      loading.value = false;
      errorMessage.value = achievementsError.message;
      return;
    } else {
      for (const row of (achievementRows as Array<{
        user_id: string;
        achievement:
          | { icon_emoji?: string | null }
          | Array<{ icon_emoji?: string | null }>
          | null;
      }> | null) ?? []) {
        const achievement = Array.isArray(row.achievement)
          ? row.achievement[0]
          : row.achievement;
        const icon = achievement?.icon_emoji;

        if (!icon) {
          continue;
        }

        const userBadges = badgesMap.get(row.user_id) ?? [];

        if (!userBadges.includes(icon) && userBadges.length < 4) {
          badgesMap.set(row.user_id, [...userBadges, icon]);
        }
      }
    }
  }

  const normalized = rankingRows.map((member) => {
    const profile = profilesMap.get(member.user_id);

    return {
      rank: member.rank,
      user_id: member.user_id,
      username: profile?.username ?? "Jugador",
      avatar_url: profile?.avatar_url ?? null,
      total_points: member.total_points,
      predicted_champion: championsMap.get(member.user_id) ?? null,
      current_streak: streaksMap.get(member.user_id) ?? 0,
      badge_icons: badgesMap.get(member.user_id) ?? [],
    };
  });
  const usernameByUserId = new Map<string, string>();
  for (const row of normalized) {
    usernameByUserId.set(row.user_id, row.username);
  }

  rows.value = normalized;

  const ownRow = normalized.find((entry) => entry.user_id === user.value?.id);

  if (
    previousOwnRank.value !== null &&
    ownRow?.rank !== undefined &&
    ownRow.rank < previousOwnRank.value
  ) {
    triggerRankUpCelebration(previousOwnRank.value, ownRow.rank);
  }

  previousOwnRank.value = ownRow?.rank ?? null;
  championInput.value = ownRow?.predicted_champion ?? "";
  const weekStartDate = getCurrentWeekStartDate();
  let weeklyLoadedFromMaterialized = false;

  if (userIds.length > 0 && weeklyRankingSupported.value !== false) {
    const { data: weeklyRows, error: weeklyRowsError } = await client
      .from("quiniela_weekly_rankings")
      .select("user_id, rank, weekly_points, exact_hits")
      .eq("quiniela_id", activeQuinielaId.value)
      .eq("week_start_date", weekStartDate)
      .order("rank", { ascending: true })
      .limit(5);

    if (weeklyRowsError && isMissingWeeklyRankingTableError(weeklyRowsError)) {
      weeklyRankingSupported.value = false;
      appendGamificationMessage(
        "Ranking semanal materializado no disponible aun. Aplica la migracion 0016 para habilitarlo.",
      );
    } else if (weeklyRowsError) {
      loading.value = false;
      errorMessage.value = weeklyRowsError.message;
      return;
    } else {
      weeklyRankingSupported.value = true;
      weeklyLoadedFromMaterialized = true;

      weeklyLeaders.value =
        (
          weeklyRows as Array<{
            user_id: string;
            weekly_points: number | null;
            exact_hits: number | null;
          }> | null
        )?.map((row) => ({
          user_id: row.user_id,
          username: usernameByUserId.get(row.user_id) ?? "Jugador",
          weekly_points: Number(row.weekly_points ?? 0),
          exact_hits: Number(row.exact_hits ?? 0),
        })) ?? [];
    }
  }

  if (!weeklyLoadedFromMaterialized && userIds.length > 0) {
    const { data: recentMatches, error: recentMatchesError } = await client
      .from("matches")
      .select("id")
      .eq("status", "finished")
      .gte("match_time", `${weekStartDate}T00:00:00.000Z`);

    if (!recentMatchesError) {
      const matchIds = (recentMatches ?? [])
        .map((item) => item.id as string)
        .filter(Boolean);

      if (matchIds.length > 0) {
        const { data: weeklyPredictions, error: weeklyPredictionsError } =
          await client
            .from("predictions")
            .select("user_id, points_earned")
            .eq("quiniela_id", activeQuinielaId.value)
            .in("user_id", userIds)
            .in("match_id", matchIds);

        if (!weeklyPredictionsError) {
          const weeklyMap = new Map<
            string,
            { weekly_points: number; exact_hits: number }
          >();

          for (const row of (weeklyPredictions as Array<{
            user_id: string;
            points_earned: number | null;
          }> | null) ?? []) {
            const current = weeklyMap.get(row.user_id) ?? {
              weekly_points: 0,
              exact_hits: 0,
            };
            const points = Number(row.points_earned ?? 0);

            current.weekly_points += points;
            if (points >= 3) {
              current.exact_hits += 1;
            }

            weeklyMap.set(row.user_id, current);
          }

          weeklyLeaders.value = [...weeklyMap.entries()]
            .map(([user_id, value]) => ({
              user_id,
              username: usernameByUserId.get(user_id) ?? "Jugador",
              weekly_points: value.weekly_points,
              exact_hits: value.exact_hits,
            }))
            .sort(
              (a, b) =>
                b.weekly_points - a.weekly_points ||
                b.exact_hits - a.exact_hits ||
                a.username.localeCompare(b.username),
            )
            .slice(0, 5);
        }
      }
    }
  }

  loading.value = false;
};

const loadRegisteredTeams = async () => {
  const { data, error } = await client
    .from("team_profiles")
    .select("name, code, logo_url, team_key")
    .order("name", { ascending: true });

  if (error) {
    return;
  }

  registeredTeams.value =
    (data as TeamProfileOption[] | null)?.filter((item) =>
      Boolean(item.name),
    ) ?? [];
};

const saveChampion = async () => {
  if (!activeQuinielaId.value || !user.value) {
    return;
  }

  savingChampion.value = true;
  errorMessage.value = null;

  const resolvedChampion = resolveChampionFromRegisteredTeams(
    championInput.value,
  );

  if (!resolvedChampion.matched) {
    savingChampion.value = false;
    errorMessage.value =
      "Selecciona un campeon de los equipos registrados para guardar tu pick.";
    return;
  }

  championInput.value = resolvedChampion.name ?? "";

  const { error } = await client
    .from("quiniela_members")
    .update({ predicted_champion: resolvedChampion.name })
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value);

  savingChampion.value = false;

  if (error) {
    championSaved.value = false;
    errorMessage.value = error.message;
    return;
  }

  triggerChampionCelebration();
  await loadRanking();
};

onMounted(() => {
  void Promise.all([
    loadActiveQuiniela(),
    loadRanking(),
    loadRegisteredTeams(),
  ]);
});

watch(championPickerOpen, (open) => {
  if (!process.client) {
    return;
  }

  if (open) {
    nextTick(() => {
      updateChampionDropdownPosition();
    });

    window.addEventListener("resize", onChampionDropdownViewportChange);
    window.addEventListener("scroll", onChampionDropdownViewportChange, true);
    return;
  }

  window.removeEventListener("resize", onChampionDropdownViewportChange);
  window.removeEventListener("scroll", onChampionDropdownViewportChange, true);
});

watch(
  () => activeQuinielaId.value,
  () => {
    rankUpVisible.value = false;
    previousOwnRank.value = null;
    void loadRanking();
  },
);

onBeforeUnmount(() => {
  if (championSaveTimer) {
    clearTimeout(championSaveTimer);
  }

  if (rankUpTimer) {
    clearTimeout(rankUpTimer);
  }

  if (process.client) {
    window.removeEventListener("resize", onChampionDropdownViewportChange);
    window.removeEventListener(
      "scroll",
      onChampionDropdownViewportChange,
      true,
    );
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
        <h1 class="text-base-content mt-1 text-3xl">Tabla de posiciones</h1>
      </div>
      <button class="btn btn-outline btn-sm" @click="loadRanking">
        Refrescar
      </button>
    </header>

    <WowSaveBurst
      :visible="rankUpVisible"
      class="mt-1"
      :title="rankUpTo ? `Subiste al #${rankUpTo}` : 'Subiste en la tabla'"
      :subtitle="rankUpSubtitle"
    />

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Activa una quiniela para ver posiciones.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-else
      class="champion-picker-host pitch-panel card relative z-20 rounded-2xl border border-base-300 bg-base-200/70 p-5"
    >
      <h2 class="text-primary text-lg">Prediccion de campeon</h2>
      <p class="text-base-content/70 mt-1 text-sm">
        Si aciertas antes del inicio del torneo, sumas 10 puntos bonus.
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <div class="relative z-30 min-w-55 flex-1">
          <input
            ref="championInputRef"
            v-model="championInput"
            class="input input-bordered w-full"
            placeholder="Busca y selecciona campeon"
            @focus="championPickerOpen = true"
            @input="championPickerOpen = true"
            @blur="onChampionInputBlur"
          />

          <Teleport to="body">
            <div
              v-if="championPickerOpen"
              :style="championDropdownStyle"
              class="bg-base-100/98 max-h-60 overflow-auto rounded-xl border border-base-300 shadow-2xl"
            >
              <button
                v-for="team in championOptions"
                :key="team.team_key"
                type="button"
                class="hover:bg-primary/10 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                @mousedown.prevent="selectChampionFromList(team)"
              >
                <img
                  v-if="team.logo_url"
                  :src="team.logo_url"
                  :alt="`Escudo de ${team.name}`"
                  class="h-5 w-5 rounded-full border border-base-300 object-cover"
                  loading="lazy"
                />
                <span v-else>{{ teamOptionFlag(team) }}</span>
                <span>{{ team.name }}</span>
              </button>

              <p
                v-if="championOptions.length === 0"
                class="text-base-content/70 px-3 py-3 text-xs"
              >
                Sin coincidencias en equipos registrados.
              </p>
            </div>
          </Teleport>

          <p
            v-if="selectedChampionInfo"
            class="text-base-content/70 mt-2 inline-flex items-center gap-2 text-xs"
          >
            <img
              v-if="selectedChampionInfo.logoUrl"
              :src="selectedChampionInfo.logoUrl"
              :alt="`Escudo de ${selectedChampionInfo.name}`"
              class="h-4 w-4 rounded-full border border-base-300 object-cover"
              loading="lazy"
            />
            <span v-else>{{
              teamFlagEmojiFromCode(selectedChampionInfo.code)
            }}</span>
            <span>Seleccionado: {{ selectedChampionInfo.name }}</span>
          </p>
        </div>

        <button
          :disabled="savingChampion"
          class="btn btn-primary btn-bet-glow"
          @click="saveChampion"
        >
          {{ savingChampion ? "Guardando..." : "Guardar campeon" }}
        </button>
      </div>

      <WowSaveBurst
        :visible="championSaved"
        class="mt-3"
        title="Campeon bloqueado"
        subtitle="Bonus potencial de 10 puntos"
      />
    </article>

    <article v-if="loading" class="alert rounded-2xl text-sm">
      Cargando ranking...
    </article>
    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>
    <article
      v-else
      class="overflow-hidden rounded-2xl border border-base-300 bg-base-100/70"
    >
      <div
        v-if="gamificationMessage"
        class="alert alert-warning rounded-none border-b border-base-300 text-xs"
      >
        {{ gamificationMessage }}
      </div>

      <div
        v-if="leaderRow"
        class="leader-podium border-b border-base-300 px-4 py-4 sm:px-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.14em] text-warning/80">
              {{ leaderTitle }}
            </p>
            <h2
              class="mt-1 flex items-center gap-2 text-xl font-semibold text-warning"
            >
              <span class="leader-crown" aria-hidden="true">👑</span>
              {{ leaderName }}
            </h2>
            <p class="text-sm text-base-content/75">{{ leaderGapText }}</p>
            <p class="leader-jackpot mt-1 text-sm font-semibold">
              1er lugar se lleva todo: {{ firstPlacePrizeText }}
            </p>
          </div>

          <div class="text-right">
            <p class="text-xs uppercase tracking-[0.14em] text-base-content/70">
              Puntaje top
            </p>
            <p class="leader-points text-3xl font-bold">
              {{ leaderRow.total_points }}
            </p>
            <p
              v-if="leaderRow.predicted_champion"
              class="mt-1 inline-flex items-center gap-2 text-xs text-base-content/80"
            >
              <img
                v-if="championLogoUrl(leaderRow.predicted_champion)"
                :src="
                  championLogoUrl(leaderRow.predicted_champion) || undefined
                "
                :alt="`Escudo de ${championDisplayName(leaderRow.predicted_champion)}`"
                class="h-4 w-4 rounded-full border border-base-300 object-cover"
                loading="lazy"
              />
              <span v-else>{{
                championFlag(leaderRow.predicted_champion)
              }}</span>
              <span
                >Campeon:
                {{ championDisplayName(leaderRow.predicted_champion) }}</span
              >
            </p>
            <p v-else class="text-xs text-base-content/70">Campeon: Sin pick</p>
          </div>
        </div>
      </div>
      <div class="border-b border-base-300 bg-base-200/55 px-4 py-3 sm:px-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
            Ranking semanal
          </p>
          <p class="text-base-content/70 text-xs">
            Desde {{ weeklyPeriodText }}
          </p>
        </div>

        <div v-if="weeklyLeaders.length > 0" class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="(row, index) in weeklyLeaders"
            :key="`${row.user_id}-weekly`"
            class="badge badge-outline gap-1"
          >
            <span>{{ index + 1 }}.</span>
            <span>{{ row.username }}</span>
            <span>• {{ row.weekly_points }} pts</span>
            <span>• 🎯 {{ row.exact_hits }}</span>
          </span>
        </div>
        <p v-else class="text-base-content/70 mt-2 text-xs">
          Aun no hay resultados finalizados en los ultimos 7 dias.
        </p>
      </div>

      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
        >
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Jugador</th>
            <th class="px-4 py-3">Puntos</th>
            <th class="px-4 py-3">Racha</th>
            <th class="px-4 py-3">Campeon</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.user_id"
            :class="[
              'border-t border-base-300',
              row.rank === 1 && 'leader-row',
            ]"
          >
            <td class="text-primary px-4 py-3 font-semibold">
              <div class="flex items-center gap-2">
                <span
                  v-if="medalByRank(row.rank)"
                  class="leader-medal"
                  :class="row.rank === 1 && 'leader-medal-gold'"
                >
                  {{ medalByRank(row.rank) }}
                </span>
                <span>{{ row.rank }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img
                  v-if="row.avatar_url"
                  :src="row.avatar_url"
                  alt="avatar"
                  :class="[
                    'h-7 w-7 rounded-full border border-base-300 object-cover',
                    row.rank === 1 && 'leader-avatar-ring',
                  ]"
                />
                <div
                  v-else
                  :class="[
                    'bg-primary/20 text-primary grid h-7 w-7 place-content-center rounded-full text-xs font-bold',
                    row.rank === 1 && 'leader-avatar-ring',
                  ]"
                >
                  {{ row.username.slice(0, 1).toUpperCase() }}
                </div>
                <span class="flex items-center gap-2">
                  <span>{{ row.username }}</span>
                  <span v-if="row.rank === 1" class="leader-tag">MANDA</span>
                </span>
              </div>
              <div v-if="row.badge_icons.length > 0" class="mt-1 flex gap-1">
                <span
                  v-for="(icon, index) in row.badge_icons"
                  :key="`${row.user_id}-badge-${index}`"
                  class="text-xs"
                >
                  {{ icon }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 font-semibold">{{ row.total_points }}</td>
            <td class="px-4 py-3">
              <span
                class="badge badge-sm"
                :class="
                  row.current_streak >= 3 ? 'badge-success' : 'badge-ghost'
                "
              >
                🔥 {{ row.current_streak }}
              </span>
            </td>
            <td class="text-base-content/70 px-4 py-3">
              <span
                v-if="row.predicted_champion"
                class="inline-flex items-center gap-2"
              >
                <img
                  v-if="championLogoUrl(row.predicted_champion)"
                  :src="championLogoUrl(row.predicted_champion) || undefined"
                  :alt="`Escudo de ${championDisplayName(row.predicted_champion)}`"
                  class="h-4 w-4 rounded-full border border-base-300 object-cover"
                  loading="lazy"
                />
                <span v-else>{{ championFlag(row.predicted_champion) }}</span>
                <span>{{ championDisplayName(row.predicted_champion) }}</span>
              </span>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="border-t border-base-300 bg-base-200/60 px-4 py-3 sm:px-5">
        <p
          class="text-xs font-semibold uppercase tracking-[0.14em] text-warning"
        >
          Regla oficial
        </p>
        <p class="mt-1 text-sm text-base-content/80">
          Winner takes all: el primer lugar se lleva el 100% de la bolsa
          acumulada.
        </p>
      </div>
    </article>
  </section>
</template>
