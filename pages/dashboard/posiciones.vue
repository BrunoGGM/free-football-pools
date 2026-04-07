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
}

interface TeamProfileOption {
  name: string;
  code: string | null;
  logo_url: string | null;
  team_key: string;
}

const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const activeQuinielaId = useCookie<string | null>("active_quiniela_id");
const { quiniela, loadActiveQuiniela } = useActiveQuiniela();

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
const registeredTeams = ref<TeamProfileOption[]>([]);

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

  if (process.client) {
    window.dispatchEvent(new CustomEvent("quiniela:celebration"));
  }

  championSaveTimer = setTimeout(() => {
    championSaved.value = false;
  }, 2300);
};

const isMissingRankingTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    (message.includes("quiniela_rankings") && message.includes("exist"))
  );
};

const loadRanking = async () => {
  if (!activeQuinielaId.value) {
    rows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = null;

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

  const normalized = rankingRows.map((member) => {
    const profile = profilesMap.get(member.user_id);

    return {
      rank: member.rank,
      user_id: member.user_id,
      username: profile?.username ?? "Jugador",
      avatar_url: profile?.avatar_url ?? null,
      total_points: member.total_points,
      predicted_champion: championsMap.get(member.user_id) ?? null,
    };
  });

  rows.value = normalized;

  const ownRow = normalized.find((entry) => entry.user_id === user.value?.id);
  championInput.value = ownRow?.predicted_champion ?? "";
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

onBeforeUnmount(() => {
  if (championSaveTimer) {
    clearTimeout(championSaveTimer);
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

      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
        >
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Jugador</th>
            <th class="px-4 py-3">Puntos</th>
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
            </td>
            <td class="px-4 py-3 font-semibold">{{ row.total_points }}</td>
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
