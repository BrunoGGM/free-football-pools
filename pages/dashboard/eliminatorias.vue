<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const activeQuinielaId = useCookie<string | null>("active_quiniela_id");

const knockoutStages = [
  "round_32",
  "round_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
];

const { matches, loading, errorMessage, refresh } =
  useMatchesRealtime(knockoutStages);

const grouped = computed(() => {
  const buckets: Record<string, typeof matches.value> = {
    round_32: [],
    round_16: [],
    quarter_final: [],
    semi_final: [],
    third_place: [],
    final: [],
  };

  for (const match of matches.value) {
    const bucket = buckets[match.stage];

    if (bucket) {
      bucket.push(match);
    }
  }

  return buckets;
});

const stageName = (stage: string) => {
  const map: Record<string, string> = {
    round_32: "Round 32",
    round_16: "Round 16",
    quarter_final: "Cuartos",
    semi_final: "Semis",
    third_place: "Tercer lugar",
    final: "Final",
  };

  return map[stage] ?? stage;
};
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
          Dashboard
        </p>
        <h1 class="mt-1 text-3xl text-white">Llaves eliminatorias</h1>
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
      Selecciona una quiniela primero para enviar predicciones.
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
      Cargando llaves...
    </article>
    <article
      v-else-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-200"
    >
      {{ errorMessage }}
    </article>

    <div v-else class="grid gap-5 xl:grid-cols-6">
      <section v-for="stage in knockoutStages" :key="stage" class="space-y-3">
        <h2 class="text-lg text-emerald-200">{{ stageName(stage) }}</h2>
        <div class="space-y-4">
          <MatchCard
            v-for="match in grouped[stage] || []"
            :key="match.id"
            :match="match"
            :editable="Boolean(activeQuinielaId)"
          />
          <article
            v-if="(grouped[stage] || []).length === 0"
            class="rounded-2xl border border-dashed border-white/12 bg-black/15 p-4 text-xs text-(--text-muted)"
          >
            Sin partidos cargados para esta ronda.
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
