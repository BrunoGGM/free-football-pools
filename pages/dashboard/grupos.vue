<script setup lang="ts">
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

const stageTitle = (stage: string) =>
  stage.replace("group_", "Grupo ").toUpperCase();
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
    <article
      v-else-if="!hasMatches"
      class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
    >
      Todavia no hay partidos de fase de grupos cargados.
    </article>

    <div v-else class="space-y-8">
      <section
        v-for="stage in groupStages"
        :key="stage"
        class="space-y-3"
        v-show="groupedMatches[stage]?.length"
      >
        <h2 class="text-xl text-emerald-200">{{ stageTitle(stage) }}</h2>
        <div class="grid gap-4 lg:grid-cols-2">
          <MatchCard
            v-for="match in groupedMatches[stage] || []"
            :key="match.id"
            :match="match"
            :editable="Boolean(activeQuinielaId)"
          />
        </div>
      </section>
    </div>
  </section>
</template>
