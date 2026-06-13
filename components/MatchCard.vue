<script setup lang="ts">
import type { MatchItem } from "~/composables/useMatchesRealtime";
import { resolveTeamCode, teamFlagEmojiFromCode } from "~/utils/teamMeta";
import "flag-icons/css/flag-icons.min.css";

const props = withDefaults(
  defineProps<{
    match: MatchItem;
    editable?: boolean;
    compact?: boolean;
  }>(),
  {
    editable: true,
    compact: false,
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

const compactHomeOutcomeLabel = computed(() => {
  return homeTeamCode.value ? `Gana ${homeTeamCode.value}` : "Gana local";
});

const compactAwayOutcomeLabel = computed(() => {
  return awayTeamCode.value ? `Gana ${awayTeamCode.value}` : "Gana visita";
});

const predictionResultStatus = computed(() => {
  if (props.match.status !== "finished") {
    return null;
  }

  if (!predictionSummary.value) {
    return {
      label: "Sin pick",
      badgeClass: "badge-ghost",
    };
  }

  if (pointsEarned.value === null) {
    return {
      label: "Pendiente",
      badgeClass: "badge-ghost",
    };
  }

  if (pointsEarned.value > 0) {
    return {
      label: `Atinaste · +${pointsEarned.value} pts`,
      badgeClass: "badge-success",
    };
  }

  return {
    label: "No atinaste",
    badgeClass: "badge-error",
  };
});

const predictionDisplayText = computed(() => {
  return predictionSummary.value || "Sin pick registrado";
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
      'pitch-panel card sweep-in overflow-hidden rounded-2xl border border-base-300 bg-base-200/70',
      props.compact ? 'p-3 md:p-3.5' : 'p-4 md:p-5',
      showSaveCelebration && 'bet-card-hit',
    ]"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
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

    <div
      :class="[
        'mt-3 grid gap-3',
        props.compact
          ? 'grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] items-center gap-2'
          : 'sm:grid-cols-[1fr_auto_1fr] sm:items-center',
      ]"
    >
      <div
        :class="[
          'bg-base-100/70 text-center min-w-0',
          props.compact ? 'rounded-lg px-2 py-2' : 'card rounded-xl p-3',
        ]"
      >
        <img
          v-if="homeLogoUrl"
          :src="homeLogoUrl"
          :alt="`Escudo de ${props.match.home_team}`"
          :class="[
            'bg-base-200 mx-auto mb-1 rounded-full object-contain',
            props.compact ? 'h-8 w-8' : 'h-10 w-10',
          ]"
          loading="lazy"
        />
        <span
          v-else-if="homeTeamFlagIconClass"
          :class="homeTeamFlagIconClass"
          class="mx-auto mb-1 block rounded-[999px]"
          :style="props.compact ? 'width: 1.75rem; height: 1.75rem' : 'width: 2rem; height: 2rem'"
          :title="`Bandera de ${props.match.home_team}`"
          aria-hidden="true"
        />
        <p v-else :class="props.compact ? 'text-xl leading-none' : 'text-2xl leading-none'">{{ homeTeamFlagEmoji }}</p>
        <p
          :class="
            props.compact
              ? 'text-base-content truncate text-sm font-semibold leading-tight'
              : 'text-base-content text-base font-semibold'
          "
          :title="props.match.home_team"
        >
          {{ props.match.home_team }}
        </p>
        <p class="text-base-content/70 text-xs">{{ homeTeamCode || "--" }}</p>
      </div>

      <div class="text-center">
        <p :class="props.compact ? 'text-base-content/70 text-xs' : 'text-base-content/70 text-sm'">Kickoff</p>
        <p :class="props.compact ? 'text-[11px] font-semibold leading-tight' : 'text-sm font-semibold'">{{ kickoffText }}</p>
        <p v-if="sourceTimeLabel" class="text-base-content/70 text-xs">
          ET {{ sourceTimeLabel }}
        </p>
        <p v-if="props.match.venue && !props.compact" class="text-base-content/70 mt-1 text-xs">
          {{ props.match.venue }}
        </p>
        <div
          :class="[
            'bg-info/10 border-info/30 mt-2 rounded-lg border',
            props.compact ? 'px-2 py-1' : 'px-3 py-1.5',
          ]"
        >
          <p class="text-info/90 text-[10px] font-semibold tracking-[0.16em]">
            GOLES
          </p>
          <p :class="props.compact ? 'text-primary text-lg font-bold' : 'text-primary text-xl font-bold'">
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
          :class="[
            'mt-1 font-semibold',
            props.compact ? 'text-[11px]' : 'text-xs',
            qualifiedTeamLabel.includes('Sin clasificado')
              ? 'text-warning'
              : qualifiedTeamLabel.includes('(penales)')
                ? 'text-info'
                : 'text-success',
          ]"
        >
          {{ qualifiedTeamLabel }}
        </p>
      </div>

      <div
        :class="[
          'bg-base-100/70 text-center min-w-0',
          props.compact ? 'rounded-lg px-2 py-2' : 'card rounded-xl p-3',
        ]"
      >
        <img
          v-if="awayLogoUrl"
          :src="awayLogoUrl"
          :alt="`Escudo de ${props.match.away_team}`"
          :class="[
            'bg-base-200 mx-auto mb-1 rounded-full object-contain',
            props.compact ? 'h-8 w-8' : 'h-10 w-10',
          ]"
          loading="lazy"
        />
        <span
          v-else-if="awayTeamFlagIconClass"
          :class="awayTeamFlagIconClass"
          class="mx-auto mb-1 block rounded-[999px]"
          :style="props.compact ? 'width: 1.75rem; height: 1.75rem' : 'width: 2rem; height: 2rem'"
          :title="`Bandera de ${props.match.away_team}`"
          aria-hidden="true"
        />
        <p v-else :class="props.compact ? 'text-xl leading-none' : 'text-2xl leading-none'">{{ awayTeamFlagEmoji }}</p>
        <p
          :class="
            props.compact
              ? 'text-base-content truncate text-sm font-semibold leading-tight'
              : 'text-base-content text-base font-semibold'
          "
          :title="props.match.away_team"
        >
          {{ props.match.away_team }}
        </p>
        <p class="text-base-content/70 text-xs">{{ awayTeamCode || "--" }}</p>
      </div>
    </div>

    <div
      :class="[
        'card mt-3 rounded-xl border border-base-300 bg-base-100/70',
        props.compact ? 'p-3' : 'p-4',
      ]"
    >
      <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
        Tu prediccion
      </p>

      <div v-if="predictionResultStatus" class="mt-2">
        <span class="badge badge-sm" :class="predictionResultStatus.badgeClass">
          {{ predictionResultStatus.label }}
        </span>
      </div>

      <template v-if="canEdit">
        <div :class="props.compact ? 'mt-2 grid grid-cols-3 gap-2' : 'mt-3 grid gap-2 sm:grid-cols-3'">
          <button
            :disabled="loading"
            class="btn btn-sm"
            :class="[selectedOutcome === 'home' ? 'btn-primary' : 'btn-outline']"
            @click="setOutcome('home')"
          >
            {{ props.compact ? compactHomeOutcomeLabel : `Gana ${props.match.home_team}` }}
          </button>
          <button
            :disabled="loading"
            class="btn btn-sm"
            :class="[selectedOutcome === 'draw' ? 'btn-primary' : 'btn-outline']"
            @click="setOutcome('draw')"
          >
            Empate
          </button>
          <button
            :disabled="loading"
            class="btn btn-sm"
            :class="[selectedOutcome === 'away' ? 'btn-primary' : 'btn-outline']"
            @click="setOutcome('away')"
          >
            {{ props.compact ? compactAwayOutcomeLabel : `Gana ${props.match.away_team}` }}
          </button>
        </div>

        <div :class="props.compact ? 'mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2' : 'mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3'">
          <input
            v-model="homePrediction"
            :disabled="loading"
            inputmode="numeric"
            :class="[
              'input input-bordered w-full text-center',
              props.compact ? 'text-base' : 'text-lg',
            ]"
            placeholder="0"
          />
          <span class="text-base-content/70 text-sm">vs</span>
          <input
            v-model="awayPrediction"
            :disabled="loading"
            inputmode="numeric"
            :class="[
              'input input-bordered w-full text-center',
              props.compact ? 'text-base' : 'text-lg',
            ]"
            placeholder="0"
          />
        </div>

        <div :class="props.compact ? 'mt-3 flex flex-wrap items-center justify-between gap-2' : 'mt-4 flex flex-wrap items-center justify-between gap-3'">
          <p :class="props.compact ? 'text-base-content/70 max-w-56 text-[11px] leading-snug' : 'text-base-content/70 text-xs'">
            +1 por resultado y +3 por marcador exacto. Editas hasta antes del kickoff.
          </p>

          <button
            :disabled="loading"
            class="btn btn-primary btn-sm btn-bet-glow"
            @click="savePrediction"
          >
            {{ loading ? "Guardando..." : "Guardar prediccion" }}
          </button>
        </div>

        <WowSaveBurst
          :visible="showSaveCelebration"
          :class="props.compact ? 'mt-2' : 'mt-3'"
          title="Ticket confirmado"
          subtitle="Tu pick ya esta en juego"
        />

        <p v-if="savedOnce" :class="props.compact ? 'text-success mt-2 text-xs' : 'text-success mt-3 text-sm'">
          Prediccion guardada.
        </p>
        <p v-if="predictionSummary" :class="props.compact ? 'text-base-content/70 mt-1 truncate text-[11px]' : 'text-base-content/70 mt-1 text-xs'" :title="predictionSummary">
          Tu pronostico: {{ predictionSummary }}
        </p>
        <p v-if="pointsEarned !== null && !predictionResultStatus" :class="props.compact ? 'text-warning mt-1 text-xs' : 'text-warning mt-1 text-sm'">
          Puntos de este partido: {{ pointsEarned }}
        </p>
        <p v-if="saveError" :class="props.compact ? 'text-error mt-2 text-xs' : 'text-error mt-3 text-sm'">{{ saveError }}</p>
      </template>

      <template v-else>
        <div class="mt-3 space-y-2">
          <div class="rounded-lg bg-base-200/60 px-3 py-2">
            <p class="text-base-content/60 text-[10px] uppercase tracking-[0.14em]">
              Tu pronostico
            </p>
            <p
              :class="
                props.compact
                  ? 'text-base-content mt-1 truncate text-sm font-medium'
                  : 'text-base-content mt-1 text-sm font-medium'
              "
              :title="predictionDisplayText"
            >
              {{ predictionDisplayText }}
            </p>
          </div>

          <p
            v-if="pointsEarned !== null && !predictionResultStatus"
            :class="props.compact ? 'text-warning text-xs' : 'text-warning text-sm'"
          >
            Puntos de este partido: {{ pointsEarned }}
          </p>
        </div>
      </template>
    </div>
  </article>
</template>
