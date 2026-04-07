<script setup lang="ts">
import type { MatchItem } from "~/composables/useMatchesRealtime";

const props = withDefaults(
  defineProps<{
    match: MatchItem;
    editable?: boolean;
  }>(),
  {
    editable: true,
  },
);

const emit = defineEmits<{
  saved: [{ matchId: string; points: number | null }];
}>();

const client = useSupabaseClient<any>();
const user = useSupabaseUser();

const homePrediction = ref<string>("");
const awayPrediction = ref<string>("");
const loading = ref(false);
const saveError = ref<string | null>(null);
const savedOnce = ref(false);
const pointsEarned = ref<number | null>(null);

const canEdit = computed(() => {
  if (!props.editable || !user.value) {
    return false;
  }

  if (props.match.status !== "pending") {
    return false;
  }

  return new Date(props.match.match_time).getTime() > Date.now();
});

const stageLabel = computed(() =>
  props.match.stage.replaceAll("_", " ").toUpperCase(),
);

const statusLabel = computed(() => {
  if (props.match.status === "finished") {
    return "FINALIZADO";
  }

  if (props.match.status === "in_progress") {
    return "EN VIVO";
  }

  return "PENDIENTE";
});

const kickoffText = computed(() => {
  return new Date(props.match.match_time).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
});

const isLive = computed(() => props.match.status === "in_progress");

const loadPrediction = async () => {
  if (!user.value) {
    homePrediction.value = "";
    awayPrediction.value = "";
    pointsEarned.value = null;
    return;
  }

  const { data, error } = await client
    .from("predictions")
    .select("home_score, away_score, points_earned")
    .eq("user_id", user.value.id)
    .eq("match_id", props.match.id)
    .maybeSingle();

  if (error) {
    saveError.value = error.message;
    return;
  }

  homePrediction.value = data?.home_score?.toString() ?? "";
  awayPrediction.value = data?.away_score?.toString() ?? "";
  pointsEarned.value = data?.points_earned ?? null;
};

const savePrediction = async () => {
  if (!user.value || !canEdit.value) {
    return;
  }

  const home = Number.parseInt(homePrediction.value, 10);
  const away = Number.parseInt(awayPrediction.value, 10);

  if (Number.isNaN(home) || Number.isNaN(away) || home < 0 || away < 0) {
    saveError.value = "Ingresa un marcador valido con numeros positivos.";
    return;
  }

  loading.value = true;
  saveError.value = null;

  const { data, error } = await client
    .from("predictions")
    .upsert(
      {
        user_id: user.value.id,
        match_id: props.match.id,
        home_score: home,
        away_score: away,
      },
      { onConflict: "user_id,match_id" },
    )
    .select("points_earned")
    .maybeSingle();

  loading.value = false;

  if (error) {
    saveError.value = error.message;
    return;
  }

  savedOnce.value = true;
  pointsEarned.value = data?.points_earned ?? null;
  emit("saved", { matchId: props.match.id, points: pointsEarned.value });
};

watch(
  () => [props.match.id, user.value?.id],
  () => {
    savedOnce.value = false;
    saveError.value = null;
    void loadPrediction();
  },
  { immediate: true },
);
</script>

<template>
  <article class="pitch-panel sweep-in overflow-hidden rounded-2xl p-4 md:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div v-if="isLive" class="live-signal" />
        <p class="text-xs font-semibold tracking-[0.18em] text-emerald-200/85">
          {{ stageLabel }}
        </p>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        :class="[
          props.match.status === 'finished' && 'bg-slate-300/10 text-slate-200',
          props.match.status === 'in_progress' &&
            'bg-emerald-400/20 text-emerald-200',
          props.match.status === 'pending' && 'bg-amber-300/15 text-amber-100',
        ]"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div class="rounded-xl bg-black/20 p-3 text-center">
        <p class="text-base font-semibold">{{ props.match.home_team }}</p>
      </div>

      <div class="text-center">
        <p class="text-sm text-(--text-muted)">Kickoff</p>
        <p class="text-sm font-semibold">{{ kickoffText }}</p>
        <p class="mt-2 text-xl font-bold text-emerald-300">
          {{ props.match.home_score ?? "-" }} :
          {{ props.match.away_score ?? "-" }}
        </p>
      </div>

      <div class="rounded-xl bg-black/20 p-3 text-center">
        <p class="text-base font-semibold">{{ props.match.away_team }}</p>
      </div>
    </div>

    <div class="mt-5 rounded-xl border border-white/8 bg-black/20 p-4">
      <p class="text-xs uppercase tracking-[0.14em] text-(--text-muted)">
        Tu prediccion
      </p>

      <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <input
          v-model="homePrediction"
          :disabled="!canEdit || loading"
          inputmode="numeric"
          class="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center text-lg outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="0"
        />
        <span class="text-sm text-(--text-muted)">vs</span>
        <input
          v-model="awayPrediction"
          :disabled="!canEdit || loading"
          inputmode="numeric"
          class="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center text-lg outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="0"
        />
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-(--text-muted)">
          {{
            canEdit
              ? "Puedes editar hasta antes del kickoff."
              : "Prediccion bloqueada para este partido."
          }}
        </p>

        <button
          :disabled="!canEdit || loading"
          class="rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
          @click="savePrediction"
        >
          {{ loading ? "Guardando..." : "Guardar prediccion" }}
        </button>
      </div>

      <p v-if="savedOnce" class="mt-3 text-sm text-emerald-200">
        Prediccion guardada.
      </p>
      <p v-if="pointsEarned !== null" class="mt-1 text-sm text-amber-200">
        Puntos de este partido: {{ pointsEarned }}
      </p>
      <p v-if="saveError" class="mt-3 text-sm text-red-300">{{ saveError }}</p>
    </div>
  </article>
</template>
