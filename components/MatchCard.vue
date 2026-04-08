<script setup lang="ts">
import type { MatchItem } from "~/composables/useMatchesRealtime";
import { resolveTeamCode, teamFlagEmojiFromCode } from "~/utils/teamMeta";
import "flag-icons/css/flag-icons.min.css";

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
const { emitPredictionSaved } = useGameUx();
const activeQuinielaId = useCookie<string | null>("active_quiniela_id");
const predictionsByQuinielaSupported = useState<boolean | null>(
  "predictions-by-quiniela-supported",
  () => null,
);

type PredictionOutcome = "home" | "draw" | "away";

const homePrediction = ref<string>("");
const awayPrediction = ref<string>("");
const selectedOutcome = ref<PredictionOutcome | null>(null);
const loading = ref(false);
const saveError = ref<string | null>(null);
const savedOnce = ref(false);
const pointsEarned = ref<number | null>(null);
const showSaveCelebration = ref(false);
let celebrationTimer: ReturnType<typeof setTimeout> | null = null;

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

const homeTeamCode = computed(
  () => props.match.home_team_code || resolveTeamCode(props.match.home_team),
);

const awayTeamCode = computed(
  () => props.match.away_team_code || resolveTeamCode(props.match.away_team),
);

const flagIconClassFromCode = (code: string | null) => {
  const normalized = (code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `fi fi-${normalized}` : null;
};

const homeTeamFlagIconClass = computed(() =>
  flagIconClassFromCode(homeTeamCode.value),
);
const awayTeamFlagIconClass = computed(() =>
  flagIconClassFromCode(awayTeamCode.value),
);
const homeTeamFlagEmoji = computed(() =>
  teamFlagEmojiFromCode(homeTeamCode.value),
);
const awayTeamFlagEmoji = computed(() =>
  teamFlagEmojiFromCode(awayTeamCode.value),
);

const sourceTimeLabel = computed(() => {
  if (!props.match.source_time) {
    return null;
  }

  return props.match.source_time.slice(0, 5);
});

const homeLogoUrl = computed(() => props.match.home_team_logo_url || null);
const awayLogoUrl = computed(() => props.match.away_team_logo_url || null);

const isLive = computed(() => props.match.status === "in_progress");

const KNOCKOUT_STAGES = new Set([
  "round_32",
  "round_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
]);

const isKnockoutMatch = computed(() => KNOCKOUT_STAGES.has(props.match.stage));

const shouldShowPenaltyLine = computed(() => {
  if (!isKnockoutMatch.value) {
    return false;
  }

  if (
    props.match.home_penalty_score !== null ||
    props.match.away_penalty_score !== null
  ) {
    return true;
  }

  return (
    props.match.status === "finished" &&
    props.match.home_score !== null &&
    props.match.away_score !== null &&
    props.match.home_score === props.match.away_score
  );
});

const qualifiedTeamLabel = computed(() => {
  if (!KNOCKOUT_STAGES.has(props.match.stage)) {
    return null;
  }

  if (
    props.match.status !== "finished" ||
    props.match.home_score === null ||
    props.match.away_score === null
  ) {
    return null;
  }

  const regularTie = props.match.home_score === props.match.away_score;

  let winner = "";
  let winnerByPenalties = false;

  if (!regularTie) {
    winner =
      props.match.home_score > props.match.away_score
        ? props.match.home_team
        : props.match.away_team;
  } else {
    const homePenalties = props.match.home_penalty_score;
    const awayPenalties = props.match.away_penalty_score;

    if (homePenalties === null || awayPenalties === null) {
      return "Sin clasificado (empate)";
    }

    if (homePenalties === awayPenalties) {
      return "Sin clasificado (penales empatados)";
    }

    winner =
      homePenalties > awayPenalties
        ? props.match.home_team
        : props.match.away_team;
    winnerByPenalties = true;
  }

  if (props.match.stage === "final") {
    return winnerByPenalties
      ? `Campeon: ${winner} (penales)`
      : `Campeon: ${winner}`;
  }

  if (props.match.stage === "third_place") {
    return winnerByPenalties
      ? `Tercer lugar: ${winner} (penales)`
      : `Tercer lugar: ${winner}`;
  }

  return winnerByPenalties
    ? `Clasifica: ${winner} (penales)`
    : `Clasifica: ${winner}`;
});

const isMissingQuinielaColumnError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42703" ||
    message.includes("predictions.quiniela_id") ||
    (message.includes("column") && message.includes("quiniela_id"))
  );
};

const outcomeFromScores = (home: number, away: number): PredictionOutcome => {
  if (home > away) {
    return "home";
  }

  if (home < away) {
    return "away";
  }

  return "draw";
};

const setOutcome = (outcome: PredictionOutcome) => {
  selectedOutcome.value = outcome;

  const home = Number.parseInt(homePrediction.value, 10);
  const away = Number.parseInt(awayPrediction.value, 10);
  const hasValidScore =
    !Number.isNaN(home) && !Number.isNaN(away) && home >= 0 && away >= 0;

  if (!hasValidScore || outcomeFromScores(home, away) !== outcome) {
    if (outcome === "home") {
      homePrediction.value = "1";
      awayPrediction.value = "0";
      return;
    }

    if (outcome === "away") {
      homePrediction.value = "0";
      awayPrediction.value = "1";
      return;
    }

    homePrediction.value = "1";
    awayPrediction.value = "1";
  }
};

const predictionSummary = computed(() => {
  const home = Number.parseInt(homePrediction.value, 10);
  const away = Number.parseInt(awayPrediction.value, 10);

  if (Number.isNaN(home) || Number.isNaN(away) || home < 0 || away < 0) {
    return null;
  }

  if (home > away) {
    return `Gana ${props.match.home_team} (${home}-${away})`;
  }

  if (home < away) {
    return `Gana ${props.match.away_team} (${home}-${away})`;
  }

  return `Empate (${home}-${away})`;
});

const triggerSaveCelebration = () => {
  if (celebrationTimer) {
    clearTimeout(celebrationTimer);
  }

  showSaveCelebration.value = true;

  celebrationTimer = setTimeout(() => {
    showSaveCelebration.value = false;
  }, 2200);
};

const loadPrediction = async () => {
  if (!user.value || !activeQuinielaId.value) {
    homePrediction.value = "";
    awayPrediction.value = "";
    selectedOutcome.value = null;
    pointsEarned.value = null;
    return;
  }

  let data: any = null;

  if (predictionsByQuinielaSupported.value === false) {
    const legacyResult = await client
      .from("predictions")
      .select("home_score, away_score, points_earned")
      .eq("user_id", user.value.id)
      .eq("match_id", props.match.id)
      .maybeSingle();

    if (legacyResult.error) {
      saveError.value = legacyResult.error.message;
      return;
    }

    data = legacyResult.data;
  } else {
    const scopedResult = await client
      .from("predictions")
      .select("home_score, away_score, points_earned")
      .eq("user_id", user.value.id)
      .eq("quiniela_id", activeQuinielaId.value)
      .eq("match_id", props.match.id)
      .maybeSingle();

    if (
      scopedResult.error &&
      isMissingQuinielaColumnError(scopedResult.error)
    ) {
      predictionsByQuinielaSupported.value = false;

      const legacyResult = await client
        .from("predictions")
        .select("home_score, away_score, points_earned")
        .eq("user_id", user.value.id)
        .eq("match_id", props.match.id)
        .maybeSingle();

      if (legacyResult.error) {
        saveError.value = legacyResult.error.message;
        return;
      }

      data = legacyResult.data;
    } else if (scopedResult.error) {
      saveError.value = scopedResult.error.message;
      return;
    } else {
      predictionsByQuinielaSupported.value = true;
      data = scopedResult.data;
    }
  }

  homePrediction.value = data?.home_score?.toString() ?? "";
  awayPrediction.value = data?.away_score?.toString() ?? "";
  if (
    typeof data?.home_score === "number" &&
    typeof data?.away_score === "number"
  ) {
    selectedOutcome.value = outcomeFromScores(data.home_score, data.away_score);
  } else {
    selectedOutcome.value = null;
  }
  pointsEarned.value = data?.points_earned ?? null;
};

const savePrediction = async () => {
  if (!user.value || !canEdit.value || !activeQuinielaId.value) {
    return;
  }

  const home = Number.parseInt(homePrediction.value, 10);
  const away = Number.parseInt(awayPrediction.value, 10);

  if (!selectedOutcome.value) {
    saveError.value =
      "Selecciona primero el resultado (local, empate o visita).";
    return;
  }

  if (Number.isNaN(home) || Number.isNaN(away) || home < 0 || away < 0) {
    saveError.value = "Ingresa un marcador valido con numeros positivos.";
    return;
  }

  const scoreOutcome = outcomeFromScores(home, away);

  if (scoreOutcome !== selectedOutcome.value) {
    saveError.value =
      "Tu marcador no coincide con el resultado seleccionado. Ajusta uno de los dos.";
    return;
  }

  loading.value = true;
  saveError.value = null;

  let data: any = null;
  let error: any = null;

  if (predictionsByQuinielaSupported.value === false) {
    const legacyResult = await client
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

    data = legacyResult.data;
    error = legacyResult.error;
  } else {
    const scopedResult = await client
      .from("predictions")
      .upsert(
        {
          user_id: user.value.id,
          quiniela_id: activeQuinielaId.value,
          match_id: props.match.id,
          home_score: home,
          away_score: away,
        },
        { onConflict: "user_id,quiniela_id,match_id" },
      )
      .select("points_earned")
      .maybeSingle();

    if (
      scopedResult.error &&
      isMissingQuinielaColumnError(scopedResult.error)
    ) {
      predictionsByQuinielaSupported.value = false;

      const legacyResult = await client
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

      data = legacyResult.data;
      error = legacyResult.error;
    } else {
      predictionsByQuinielaSupported.value = true;
      data = scopedResult.data;
      error = scopedResult.error;
    }
  }

  loading.value = false;

  if (error) {
    showSaveCelebration.value = false;
    saveError.value = error.message;
    return;
  }

  savedOnce.value = true;
  pointsEarned.value = data?.points_earned ?? null;
  triggerSaveCelebration();
  emitPredictionSaved({
    matchId: props.match.id,
    pointsEarned: pointsEarned.value,
  });
  emit("saved", { matchId: props.match.id, points: pointsEarned.value });
};

watch(
  () => [props.match.id, user.value?.id, activeQuinielaId.value],
  () => {
    showSaveCelebration.value = false;
    savedOnce.value = false;
    saveError.value = null;
    void loadPrediction();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (celebrationTimer) {
    clearTimeout(celebrationTimer);
  }
});
</script>

<template>
  <article
    :class="[
      'pitch-panel card sweep-in overflow-hidden rounded-2xl border border-base-300 bg-base-200/70 p-4 md:p-5',
      showSaveCelebration && 'bet-card-hit',
    ]"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div v-if="isLive" class="live-signal" />
        <p class="text-primary/85 text-xs font-semibold tracking-[0.18em]">
          {{ stageLabel }}
        </p>
      </div>
      <span
        class="badge badge-sm px-3 py-1 text-xs font-semibold"
        :class="[
          props.match.status === 'finished' && 'badge-neutral',
          props.match.status === 'in_progress' && 'badge-success',
          props.match.status === 'pending' && 'badge-warning',
        ]"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div class="card rounded-xl bg-base-100/70 p-3 text-center">
        <img
          v-if="homeLogoUrl"
          :src="homeLogoUrl"
          :alt="`Escudo de ${props.match.home_team}`"
          class="bg-base-200 mx-auto mb-1 h-10 w-10 rounded-full object-contain"
          loading="lazy"
        />
        <span
          v-else-if="homeTeamFlagIconClass"
          :class="homeTeamFlagIconClass"
          class="mx-auto mb-1 block rounded-[999px]"
          style="width: 2rem; height: 2rem"
          :title="`Bandera de ${props.match.home_team}`"
          aria-hidden="true"
        />
        <p v-else class="text-2xl leading-none">{{ homeTeamFlagEmoji }}</p>
        <p class="text-base-content text-base font-semibold">
          {{ props.match.home_team }}
        </p>
        <p class="text-base-content/70 text-xs">{{ homeTeamCode || "--" }}</p>
      </div>

      <div class="text-center">
        <p class="text-base-content/70 text-sm">Kickoff</p>
        <p class="text-sm font-semibold">{{ kickoffText }}</p>
        <p v-if="sourceTimeLabel" class="text-base-content/70 text-xs">
          ET {{ sourceTimeLabel }}
        </p>
        <p v-if="props.match.venue" class="text-base-content/70 mt-1 text-xs">
          {{ props.match.venue }}
        </p>
        <div
          class="bg-info/10 border-info/30 mt-2 rounded-lg border px-3 py-1.5"
        >
          <p class="text-info/90 text-[10px] font-semibold tracking-[0.16em]">
            GOLES
          </p>
          <p class="text-primary text-xl font-bold">
            {{ props.match.home_score ?? "-" }} :
            {{ props.match.away_score ?? "-" }}
          </p>
        </div>
        <div
          v-if="shouldShowPenaltyLine"
          class="bg-warning/10 border-warning/40 mt-2 rounded-lg border border-dashed px-3 py-1.5"
        >
          <p
            class="text-warning/90 text-[10px] font-semibold tracking-[0.16em]"
          >
            PENALES
          </p>
          <p class="text-warning text-lg font-bold">
            {{ props.match.home_penalty_score ?? "-" }} :
            {{ props.match.away_penalty_score ?? "-" }}
          </p>
        </div>
        <p
          v-if="qualifiedTeamLabel"
          class="mt-1 text-xs font-semibold"
          :class="
            qualifiedTeamLabel.includes('Sin clasificado')
              ? 'text-warning'
              : qualifiedTeamLabel.includes('(penales)')
                ? 'text-info'
                : 'text-success'
          "
        >
          {{ qualifiedTeamLabel }}
        </p>
      </div>

      <div class="card rounded-xl bg-base-100/70 p-3 text-center">
        <img
          v-if="awayLogoUrl"
          :src="awayLogoUrl"
          :alt="`Escudo de ${props.match.away_team}`"
          class="bg-base-200 mx-auto mb-1 h-10 w-10 rounded-full object-contain"
          loading="lazy"
        />
        <span
          v-else-if="awayTeamFlagIconClass"
          :class="awayTeamFlagIconClass"
          class="mx-auto mb-1 block rounded-[999px]"
          style="width: 2rem; height: 2rem"
          :title="`Bandera de ${props.match.away_team}`"
          aria-hidden="true"
        />
        <p v-else class="text-2xl leading-none">{{ awayTeamFlagEmoji }}</p>
        <p class="text-base-content text-base font-semibold">
          {{ props.match.away_team }}
        </p>
        <p class="text-base-content/70 text-xs">{{ awayTeamCode || "--" }}</p>
      </div>
    </div>

    <div class="card mt-5 rounded-xl border border-base-300 bg-base-100/70 p-4">
      <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
        Tu prediccion
      </p>

      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          :disabled="!canEdit || loading"
          class="btn btn-sm"
          :class="[selectedOutcome === 'home' ? 'btn-primary' : 'btn-outline']"
          @click="setOutcome('home')"
        >
          Gana {{ props.match.home_team }}
        </button>
        <button
          :disabled="!canEdit || loading"
          class="btn btn-sm"
          :class="[selectedOutcome === 'draw' ? 'btn-primary' : 'btn-outline']"
          @click="setOutcome('draw')"
        >
          Empate
        </button>
        <button
          :disabled="!canEdit || loading"
          class="btn btn-sm"
          :class="[selectedOutcome === 'away' ? 'btn-primary' : 'btn-outline']"
          @click="setOutcome('away')"
        >
          Gana {{ props.match.away_team }}
        </button>
      </div>

      <div class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <input
          v-model="homePrediction"
          :disabled="!canEdit || loading"
          inputmode="numeric"
          class="input input-bordered w-full text-center text-lg"
          placeholder="0"
        />
        <span class="text-base-content/70 text-sm">vs</span>
        <input
          v-model="awayPrediction"
          :disabled="!canEdit || loading"
          inputmode="numeric"
          class="input input-bordered w-full text-center text-lg"
          placeholder="0"
        />
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p class="text-base-content/70 text-xs">
          {{
            canEdit
              ? "+1 por resultado y +3 por marcador exacto. Editas hasta antes del kickoff."
              : "Prediccion bloqueada para este partido."
          }}
        </p>

        <button
          :disabled="!canEdit || loading"
          class="btn btn-primary btn-sm btn-bet-glow"
          @click="savePrediction"
        >
          {{ loading ? "Guardando..." : "Guardar prediccion" }}
        </button>
      </div>

      <WowSaveBurst
        :visible="showSaveCelebration"
        class="mt-3"
        title="Ticket confirmado"
        subtitle="Tu pick ya esta en juego"
      />

      <p v-if="savedOnce" class="text-success mt-3 text-sm">
        Prediccion guardada.
      </p>
      <p v-if="predictionSummary" class="text-base-content/70 mt-1 text-xs">
        Tu pronostico: {{ predictionSummary }}
      </p>
      <p v-if="pointsEarned !== null" class="text-warning mt-1 text-sm">
        Puntos de este partido: {{ pointsEarned }}
      </p>
      <p v-if="saveError" class="text-error mt-3 text-sm">{{ saveError }}</p>
    </div>
  </article>
</template>
