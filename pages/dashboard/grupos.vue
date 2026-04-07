<script setup lang="ts">
import {
  normalizeTeamKey,
  resolveTeamCode,
  teamFlagEmojiFromCode,
} from "~/utils/teamMeta";

definePageMeta({
  middleware: ["auth"],
});

const activeQuinielaId = useCookie<string | null>("active_quiniela_id");

const groupStages = [
  "group_a",
  "group_b",
  "group_c",
  "group_d",
  "group_e",
  "group_f",
  "group_g",
  "group_h",
  "group_i",
  "group_j",
  "group_k",
  "group_l",
];

const { matches, loading, errorMessage, refresh } =
  useMatchesRealtime(groupStages);

const groupedMatches = computed(() => {
  const groups: Record<string, typeof matches.value> = {};

  for (const stage of groupStages) {
    groups[stage] = [];
  }

  for (const match of matches.value) {
    const bucket = groups[match.stage];

    if (bucket) {
      bucket.push(match);
    }
  }

  return groups;
});

const hasMatches = computed(() => matches.value.length > 0);
const activeStage = ref<string>("group_a");

const activeMatches = computed(
  () => groupedMatches.value?.[activeStage.value] ?? [],
);

const stageTabs = computed(() =>
  groupStages.map((stage) => ({
    stage,
    title: stageTitle(stage),
    count: groupedMatches.value[stage]?.length ?? 0,
  })),
);

interface TeamPerformanceRow {
  team: string;
  code: string | null;
  logoUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
}

const performanceRows = computed<TeamPerformanceRow[]>(() => {
  const table = new Map<
    string,
    Omit<TeamPerformanceRow, "goalDiff" | "rank">
  >();

  const ensureTeam = (
    name: string,
    code: string | null,
    logoUrl: string | null,
  ) => {
    const key = normalizeTeamKey(name);

    if (!table.has(key)) {
      table.set(key, {
        team: name,
        code,
        logoUrl,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
    }

    const row = table.get(key)!;

    if (!row.code && code) {
      row.code = code;
    }

    if (!row.logoUrl && logoUrl) {
      row.logoUrl = logoUrl;
    }

    return row;
  };

  for (const match of activeMatches.value) {
    const homeCode = match.home_team_code || resolveTeamCode(match.home_team);
    const awayCode = match.away_team_code || resolveTeamCode(match.away_team);
    const home = ensureTeam(
      match.home_team,
      homeCode,
      match.home_team_logo_url || null,
    );
    const away = ensureTeam(
      match.away_team,
      awayCode,
      match.away_team_logo_url || null,
    );

    if (
      match.status === "pending" ||
      match.home_score === null ||
      match.away_score === null
    ) {
      continue;
    }

    home.played += 1;
    away.played += 1;

    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (match.home_score < match.away_score) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const sorted = Array.from(table.values())
    .map((row) => ({
      ...row,
      goalDiff: row.goalsFor - row.goalsAgainst,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor ||
        a.team.localeCompare(b.team),
    );

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
});

const hasPerformanceData = computed(() => performanceRows.value.length > 0);

const stageTitle = (stage: string) =>
  stage.replace("group_", "Grupo ").toUpperCase();

const teamFlag = (code: string | null) => teamFlagEmojiFromCode(code);

watch(
  hasMatches,
  (value) => {
    if (!value) {
      return;
    }

    const firstWithMatches = stageTabs.value.find((stage) => stage.count > 0);

    if (firstWithMatches) {
      activeStage.value = firstWithMatches.stage;
    }
  },
  { immediate: true },
);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
          Dashboard
        </p>
        <h1 class="mt-1 text-3xl text-white">Partidos de grupos</h1>
      </div>

      <button
        class="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="refresh"
      >
        Refrescar
      </button>
    </header>

    <article
      v-if="!activeQuinielaId"
      class="pitch-panel rounded-2xl border border-amber-300/25 p-5 text-amber-100"
    >
      Selecciona una quiniela primero desde ingresar para activar guardado de
      predicciones.
      <NuxtLink
        to="/ingresar"
        class="ml-2 font-semibold underline underline-offset-4"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-if="loading"
      class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
    >
      Cargando partidos...
    </article>
    <article
      v-else-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-200"
    >
      {{ errorMessage }}
    </article>
    <div v-else class="space-y-8">
      <article
        v-if="!hasMatches"
        class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
      >
        Todavia no hay partidos de fase de grupos cargados. La tabla de
        rendimiento se mostrara en cuanto haya resultados.
      </article>

      <article class="pitch-panel rounded-2xl p-4">
        <p class="text-xs uppercase tracking-[0.14em] text-(--text-muted)">
          Navegacion por grupos
        </p>
        <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="stage in stageTabs"
            :key="stage.stage"
            class="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition"
            :class="[
              activeStage === stage.stage
                ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100'
                : 'border-white/12 bg-black/25 text-slate-200 hover:border-emerald-300/35 hover:text-emerald-100',
            ]"
            @click="activeStage = stage.stage"
          >
            {{ stage.title }}
            <span
              class="ml-2 rounded-full px-2 py-0.5 text-xs"
              :class="[
                activeStage === stage.stage
                  ? 'bg-emerald-400/30 text-emerald-100'
                  : 'bg-white/10 text-slate-200',
              ]"
            >
              {{ stage.count }}
            </span>
          </button>
        </div>
      </article>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl text-emerald-200">
            Rendimiento de {{ stageTitle(activeStage) }}
          </h2>
          <p class="text-xs text-(--text-muted)">
            Solo selecciones del grupo activo
          </p>
        </div>

        <article
          class="overflow-x-auto rounded-2xl border border-white/8 bg-black/25"
        >
          <table class="min-w-full text-sm">
            <thead
              class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              <tr>
                <th class="px-4 py-3">#</th>
                <th class="px-4 py-3">Seleccion</th>
                <th class="px-4 py-3">PJ</th>
                <th class="px-4 py-3">PG</th>
                <th class="px-4 py-3">PE</th>
                <th class="px-4 py-3">PP</th>
                <th class="px-4 py-3">GF</th>
                <th class="px-4 py-3">GC</th>
                <th class="px-4 py-3">DG</th>
                <th class="px-4 py-3">Pts</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in performanceRows"
                :key="row.team"
                class="border-t border-white/8"
              >
                <td class="px-4 py-3 font-semibold text-emerald-200">
                  {{ row.rank }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="row.logoUrl"
                      :src="row.logoUrl"
                      :alt="`Bandera de ${row.team}`"
                      class="h-5 w-5 rounded-full border border-white/15 bg-white/10 object-cover"
                      loading="lazy"
                    />
                    <span v-else class="text-base">{{
                      teamFlag(row.code)
                    }}</span>
                    <span>{{ row.team }}</span>
                  </div>
                </td>
                <td class="px-4 py-3">{{ row.played }}</td>
                <td class="px-4 py-3">{{ row.won }}</td>
                <td class="px-4 py-3">{{ row.drawn }}</td>
                <td class="px-4 py-3">{{ row.lost }}</td>
                <td class="px-4 py-3">{{ row.goalsFor }}</td>
                <td class="px-4 py-3">{{ row.goalsAgainst }}</td>
                <td class="px-4 py-3">{{ row.goalDiff }}</td>
                <td class="px-4 py-3 font-semibold text-amber-200">
                  {{ row.points }}
                </td>
              </tr>
              <tr v-if="!hasPerformanceData" class="border-t border-white/8">
                <td
                  colspan="10"
                  class="px-4 py-6 text-center text-sm text-(--text-muted)"
                >
                  Aun no hay paises cargados para este grupo.
                </td>
              </tr>
            </tbody>
          </table>
        </article>
      </section>

      <section class="space-y-3">
        <h2 class="text-xl text-emerald-200">{{ stageTitle(activeStage) }}</h2>
        <div v-if="activeMatches.length" class="grid gap-4 lg:grid-cols-2">
          <MatchCard
            v-for="match in activeMatches"
            :key="match.id"
            :match="match"
            :editable="Boolean(activeQuinielaId)"
          />
        </div>
        <article
          v-else
          class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
        >
          Todavia no hay partidos cargados para este grupo.
        </article>
      </section>
    </div>
  </section>
</template>
