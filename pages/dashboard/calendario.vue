<script setup lang="ts">
import MatchCard from "~/components/MatchCard.vue";
import type { MatchItem } from "~/composables/useMatchesRealtime";

definePageMeta({
  middleware: ["auth"],
});

const activeQuinielaId = useCookie<string | null>("active_quiniela_id");
const { matches, loading, errorMessage, refresh } = useMatchesRealtime();

const search = ref("");

const stageLabel = (stage: string) => {
  const groupMatch = /^group_([a-z])$/i.exec(stage);

  if (groupMatch) {
    return `Grupo ${groupMatch[1].toUpperCase()}`;
  }

  const labels: Record<string, string> = {
    round_32: "Dieciseisavos",
    round_16: "Octavos",
    quarter_final: "Cuartos",
    semi_final: "Semifinal",
    third_place: "Tercer lugar",
    final: "Final",
  };

  return labels[stage] ?? stage.replaceAll("_", " ");
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

const localDayKey = (iso: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "sin-fecha";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const orderedMatches = computed(() =>
  matches.value
    .slice()
    .sort(
      (a, b) =>
        new Date(a.match_time).getTime() - new Date(b.match_time).getTime(),
    ),
);

const visibleMatches = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) {
    return orderedMatches.value;
  }

  return orderedMatches.value.filter((match) => {
    const haystack = [
      match.home_team,
      match.away_team,
      stageLabel(match.stage),
      match.venue || "",
      match.status,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
});

const groupedMatches = computed(() => {
  const groups: Array<{
    key: string;
    label: string;
    matches: MatchItem[];
  }> = [];

  for (const match of visibleMatches.value) {
    const date = new Date(match.match_time);
    const key = localDayKey(match.match_time);
    const label = Number.isNaN(date.getTime()) ? "Sin fecha" : dayLabel(match.match_time);
    const current = groups.at(-1);

    if (!current || current.key !== key) {
      groups.push({
        key,
        label,
        matches: [match],
      });
      continue;
    }

    current.matches.push(match);
  }

  return groups;
});

const totalPending = computed(
  () => visibleMatches.value.filter((match) => match.status === "pending").length,
);
const totalLive = computed(
  () => visibleMatches.value.filter((match) => match.status === "in_progress").length,
);
const totalFinished = computed(
  () => visibleMatches.value.filter((match) => match.status === "finished").length,
);
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Partidos
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Calendario completo</h1>
        <p class="text-base-content/70 mt-2 text-sm">
          Todos los partidos del torneo ordenados por fecha, desde fase de grupos
          hasta la final.
        </p>
      </div>

      <button class="btn btn-outline btn-sm" @click="refresh">Refrescar</button>
    </header>

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Selecciona una quiniela primero para ver el calendario completo.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-else
      class="rounded-3xl border border-base-300 bg-base-200/60 p-4 shadow-sm"
    >
      <div class="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,160px)] lg:items-center">
        <label class="input input-bordered flex items-center gap-2">
          <span class="text-base-content/60 text-xs uppercase">Buscar</span>
          <input
            v-model="search"
            type="text"
            class="grow"
            placeholder="Equipo, fase, sede o estado"
          />
        </label>

        <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
          <p class="text-base-content/60 text-xs uppercase">Pendientes</p>
          <p class="mt-1 text-xl font-semibold">{{ totalPending }}</p>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
          <p class="text-base-content/60 text-xs uppercase">En vivo</p>
          <p class="mt-1 text-xl font-semibold">{{ totalLive }}</p>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
          <p class="text-base-content/60 text-xs uppercase">Finalizados</p>
          <p class="mt-1 text-xl font-semibold">{{ totalFinished }}</p>
        </article>
      </div>
    </article>

    <article v-if="loading" class="alert rounded-2xl text-sm">
      Cargando calendario...
    </article>
    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>
    <article
      v-else-if="visibleMatches.length === 0"
      class="alert rounded-2xl text-sm"
    >
      No hay partidos para el filtro actual.
    </article>

    <div v-else class="space-y-6">
      <section
        v-for="group in groupedMatches"
        :key="group.key"
        class="space-y-3"
      >
        <div class="flex items-center gap-3">
          <span class="badge badge-primary badge-outline">{{ group.matches.length }} partidos</span>
          <h2 class="text-base-content text-lg font-semibold capitalize">
            {{ group.label }}
          </h2>
        </div>

        <div class="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          <article
            v-for="match in group.matches"
            :key="match.id"
            class="space-y-2"
          >
            <div class="flex flex-wrap items-center gap-2 px-1 text-xs text-base-content/70">
              <span class="badge badge-outline">{{ stageLabel(match.stage) }}</span>
              <span v-if="match.venue">{{ match.venue }}</span>
            </div>
            <MatchCard :match="match" compact />
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
