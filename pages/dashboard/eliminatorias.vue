<script setup lang="ts">
import KnockoutBracketViewer from "~/components/dashboard/KnockoutBracketViewer.client.vue";

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

type EliminatoriasViewMode = "cards" | "bracket";

const viewMode = ref<EliminatoriasViewMode>("cards");
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
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Dashboard
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Llaves eliminatorias</h1>
      </div>

      <button class="btn btn-outline btn-sm" @click="refresh">Refrescar</button>
    </header>

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Selecciona una quiniela primero para enviar predicciones.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article v-if="loading" class="alert rounded-2xl text-sm">
      Cargando llaves...
    </article>
    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>

    <div v-else class="space-y-5">
      <article
        class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-4 md:p-5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="btn btn-sm"
            :class="viewMode === 'cards' ? 'btn-primary' : 'btn-outline'"
            @click="viewMode = 'cards'"
          >
            Rondas
          </button>
          <button
            class="btn btn-sm"
            :class="viewMode === 'bracket' ? 'btn-primary' : 'btn-outline'"
            @click="viewMode = 'bracket'"
          >
            Bracket visual
          </button>
        </div>

        <p class="text-base-content/70 mt-3 text-xs">
          {{
            viewMode === "cards"
              ? "Vista detallada por ronda para capturar y editar predicciones."
              : "Vista de llaves estilo cuadro para seguir el camino a la final."
          }}
        </p>
      </article>

      <template v-if="viewMode === 'cards'">
        <article
          class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-4 md:p-5"
        >
          <div class="flex gap-2 overflow-x-auto pb-2">
            <button
              v-for="stage in knockoutStages"
              :key="stage"
              class="btn btn-sm min-w-fit"
              :class="activeStage === stage ? 'btn-primary' : 'btn-outline'"
              @click="activeStage = stage"
            >
              {{ stageName(stage) }}
              <span class="badge badge-sm ml-2 badge-ghost">
                {{ stageMatchCount(stage) }}
              </span>
            </button>
          </div>

          <div
            class="mt-4 grid items-center gap-3 md:grid-cols-[auto_1fr_auto]"
          >
            <button
              class="btn btn-outline btn-sm"
              :disabled="!hasPrevStage"
              @click="goPrevStage"
            >
              Anterior
            </button>

            <div
              class="card rounded-xl border border-base-300 bg-base-100/70 px-4 py-3 text-center"
            >
              <h2 class="text-primary text-lg">
                {{ stageName(activeStage) }}
              </h2>
              <p class="text-base-content/70 mt-1 text-xs">
                {{ stageHint(activeStage) }}
              </p>
            </div>

            <button
              class="btn btn-outline btn-sm"
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
            class="alert rounded-2xl border border-dashed border-base-300 text-sm"
          >
            Sin partidos cargados para
            {{ stageName(activeStage).toLowerCase() }}.
          </article>
        </section>
      </template>

      <KnockoutBracketViewer v-else :matches="matches" />
    </div>
  </section>
</template>
