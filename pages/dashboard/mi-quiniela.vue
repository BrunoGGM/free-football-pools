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

const user = useSupabaseUser();
const client = useSupabaseClient<any>();
const { quiniela, activeQuinielaId, loadActiveQuiniela } = useActiveQuiniela();

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const memberTotalPoints = ref(0);
const predictedChampion = ref<string | null>(null);
const predictions = ref<PredictionRow[]>([]);

const username = computed(() => {
  const metadataName = user.value?.user_metadata?.username;

  if (typeof metadataName === "string" && metadataName.length > 0) {
    return metadataName;
  }

  const email = user.value?.email;
  return email ? email.split("@")[0] : "Jugador";
});

const hasPredictions = computed(() => predictions.value.length > 0);

const stageLabel = (stage: string) => stage.replaceAll("_", " ").toUpperCase();

const kickoffText = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const teamFlag = (code: string | null, team: string) => {
  const resolvedCode = code || resolveTeamCode(team);
  return teamFlagEmojiFromCode(resolvedCode);
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

  if (row.points_earned >= 3) {
    return "Ganadora exacta";
  }

  if (row.points_earned >= 1) {
    return "Ganadora resultado";
  }

  return "Perdedora";
};

const outcomeClass = (row: PredictionRow) => {
  if (!row.match || row.match.status === "pending") {
    return "bg-slate-300/10 text-slate-200";
  }

  if (row.match.status === "in_progress") {
    return "bg-amber-400/20 text-amber-100";
  }

  if (row.points_earned >= 3) {
    return "bg-emerald-400/20 text-emerald-100";
  }

  if (row.points_earned >= 1) {
    return "bg-sky-400/20 text-sky-100";
  }

  return "bg-red-400/20 text-red-100";
};

const loadMyQuinielaView = async () => {
  if (!user.value || !activeQuinielaId.value) {
    predictions.value = [];
    memberTotalPoints.value = 0;
    predictedChampion.value = null;
    return;
  }

  loading.value = true;
  errorMessage.value = null;

  const [memberResult, predictionsResult] = await Promise.all([
    client
      .from("quiniela_members")
      .select("total_points, predicted_champion")
      .eq("user_id", user.value.id)
      .eq("quiniela_id", activeQuinielaId.value)
      .maybeSingle(),
    client
      .from("predictions")
      .select(
        "id, home_score, away_score, points_earned, created_at, match:matches(id, stage, status, match_time, home_team, away_team, home_score, away_score, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url)",
      )
      .eq("user_id", user.value.id)
      .order("match_time", { ascending: true, referencedTable: "matches" }),
  ]);

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
};

onMounted(async () => {
  await loadActiveQuiniela();
  await loadMyQuinielaView();
});

watch(
  () => activeQuinielaId.value,
  () => {
    void loadMyQuinielaView();
  },
);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
          Dashboard
        </p>
        <h1 class="mt-1 text-3xl text-white">Mi quiniela</h1>
      </div>
      <button
        class="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="loadMyQuinielaView"
      >
        Refrescar
      </button>
    </header>

    <article
      v-if="!activeQuinielaId"
      class="pitch-panel rounded-2xl border border-amber-300/25 p-5 text-amber-100"
    >
      No tienes una quiniela activa para mostrar tus respuestas.
      <NuxtLink
        to="/ingresar"
        class="ml-2 font-semibold underline underline-offset-4"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article v-else class="pitch-panel neon-border rounded-3xl p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
        Resumen personal
      </p>
      <h2 class="mt-2 text-3xl text-white sm:text-4xl">{{ username }}</h2>
      <p class="mt-2 text-sm text-(--text-muted)">
        Quiniela activa: {{ quiniela?.name || "Sin nombre" }}
      </p>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p class="text-xs uppercase tracking-[0.14em] text-(--text-muted)">
            Puntos totales
          </p>
          <p class="mt-1 text-3xl font-bold text-amber-200">
            {{ memberTotalPoints }}
          </p>
        </div>

        <div class="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p class="text-xs uppercase tracking-[0.14em] text-(--text-muted)">
            Campeon predicho
          </p>
          <p class="mt-1 text-lg font-semibold text-emerald-100">
            {{ predictedChampion || "No definido" }}
          </p>
        </div>
      </div>
    </article>

    <article
      v-if="loading"
      class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
    >
      Cargando tus predicciones...
    </article>
    <article
      v-else-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-200"
    >
      {{ errorMessage }}
    </article>
    <article
      v-else-if="!hasPredictions"
      class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
    >
      Todavia no has guardado predicciones.
    </article>
    <article
      v-else
      class="overflow-x-auto rounded-2xl border border-white/8 bg-black/25"
    >
      <table class="min-w-full text-sm">
        <thead
          class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
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
            class="border-t border-white/8 align-top"
          >
            <td class="px-4 py-3">
              <p class="text-xs text-(--text-muted)">
                {{ row.match ? stageLabel(row.match.stage) : "-" }}
              </p>
              <div class="mt-1 flex items-center gap-2">
                <img
                  v-if="row.match?.home_team_logo_url"
                  :src="row.match.home_team_logo_url"
                  :alt="`Escudo de ${row.match.home_team}`"
                  class="h-5 w-5 rounded-full border border-white/15 object-cover"
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
                <span class="text-(--text-muted)">vs</span>
                <img
                  v-if="row.match?.away_team_logo_url"
                  :src="row.match.away_team_logo_url"
                  :alt="`Escudo de ${row.match.away_team}`"
                  class="h-5 w-5 rounded-full border border-white/15 object-cover"
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
              <p class="mt-1 text-xs text-(--text-muted)">
                {{ row.match ? kickoffText(row.match.match_time) : "-" }}
              </p>
            </td>
            <td class="px-4 py-3 font-semibold">
              {{ row.home_score }} : {{ row.away_score }}
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
              <span v-else class="text-(--text-muted)">Pendiente</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="outcomeClass(row)"
              >
                {{ outcomeLabel(row) }}
              </span>
            </td>
            <td class="px-4 py-3 font-semibold text-amber-200">
              {{ row.points_earned }}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>
