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

const activeStage = ref<string>(knockoutStages[0] ?? "round_32");
const autoStageSelected = ref(false);

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
    round_32: "Dieciseisavos",
    round_16: "Octavos",
    quarter_final: "Cuartos",
    semi_final: "Semifinal",
    third_place: "Tercer lugar",
    final: "Final",
  };

  return map[stage] ?? stage;
};

const stageHint = (stage: string) => {
  const map: Record<string, string> = {
    round_32: "32 equipos, inicio del cuadro final.",
    round_16: "16 equipos, cruces directos.",
    quarter_final: "8 equipos, camino a semifinales.",
    semi_final: "4 equipos, partido por el pase a la final.",
    third_place: "Partido para definir tercer y cuarto lugar.",
    final: "Partido decisivo por el campeonato.",
  };

  return map[stage] ?? "";
};

const activeStageIndex = computed(() =>
  knockoutStages.indexOf(activeStage.value),
);

const hasPrevStage = computed(() => activeStageIndex.value > 0);
const hasNextStage = computed(
  () => activeStageIndex.value < knockoutStages.length - 1,
);

const activeStageMatches = computed(
  () => grouped.value[activeStage.value] || [],
);

const stageMatchCount = (stage: string) => grouped.value[stage]?.length ?? 0;

const goPrevStage = () => {
  if (!hasPrevStage.value) {
    return;
  }

  activeStage.value =
    knockoutStages[activeStageIndex.value - 1] ?? activeStage.value;
};

const goNextStage = () => {
  if (!hasNextStage.value) {
    return;
  }

  activeStage.value =
    knockoutStages[activeStageIndex.value + 1] ?? activeStage.value;
};

watch(
  () => matches.value.length,
  () => {
    if (autoStageSelected.value) {
      return;
    }

    const firstWithMatches = knockoutStages.find(
      (stage) => (grouped.value[stage]?.length ?? 0) > 0,
    );

    if (firstWithMatches) {
      activeStage.value = firstWithMatches;
      autoStageSelected.value = true;
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

    <div v-else class="space-y-5">
      <article class="pitch-panel rounded-2xl p-4 md:p-5">
        <div class="flex gap-2 overflow-x-auto pb-2">
          <button
            v-for="stage in knockoutStages"
            :key="stage"
            class="min-w-fit rounded-full border px-4 py-2 text-sm transition"
            :class="
              activeStage === stage
                ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100'
                : 'border-white/12 text-slate-200 hover:border-white/30 hover:text-white'
            "
            @click="activeStage = stage"
          >
            {{ stageName(stage) }}
            <span class="ml-2 rounded-full bg-black/30 px-2 py-0.5 text-xs">
              {{ stageMatchCount(stage) }}
            </span>
          </button>
        </div>

        <div class="mt-4 grid items-center gap-3 md:grid-cols-[auto_1fr_auto]">
          <button
            class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!hasPrevStage"
            @click="goPrevStage"
          >
            Anterior
          </button>

          <div
            class="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-center"
          >
            <h2 class="text-lg text-emerald-200">
              {{ stageName(activeStage) }}
            </h2>
            <p class="mt-1 text-xs text-(--text-muted)">
              {{ stageHint(activeStage) }}
            </p>
          </div>

          <button
            class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!hasNextStage"
            @click="goNextStage"
          >
            Siguiente
          </button>
        </div>
      </article>

      <section class="mx-auto w-full max-w-6xl">
        <div class="grid gap-4 2xl:grid-cols-2">
          <MatchCard
            v-for="match in activeStageMatches"
            :key="match.id"
            :match="match"
            :editable="Boolean(activeQuinielaId)"
          />
        </div>

        <article
          v-if="activeStageMatches.length === 0"
          class="rounded-2xl border border-dashed border-white/12 bg-black/15 p-5 text-sm text-(--text-muted)"
        >
          Sin partidos cargados para {{ stageName(activeStage).toLowerCase() }}.
        </article>
      </section>
    </div>
  </section>
</template>
