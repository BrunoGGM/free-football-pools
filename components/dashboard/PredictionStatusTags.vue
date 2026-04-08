<script setup lang="ts">
type MatchStatus = "pending" | "in_progress" | "finished";

type Tag = {
  label: string;
  badgeClass: string;
};

const props = withDefaults(
  defineProps<{
    matchStatus?: MatchStatus | null;
    predictedHomeScore?: number | null;
    predictedAwayScore?: number | null;
    officialHomeScore?: number | null;
    officialAwayScore?: number | null;
    compact?: boolean;
  }>(),
  {
    matchStatus: null,
    predictedHomeScore: null,
    predictedAwayScore: null,
    officialHomeScore: null,
    officialAwayScore: null,
    compact: false,
  },
);

const tags = computed<Tag[]>(() => {
  const result: Tag[] = [];

  if (!props.matchStatus) {
    return [{ label: "Sin partido", badgeClass: "badge-ghost" }];
  }

  if (props.matchStatus === "pending") {
    result.push({ label: "Pendiente", badgeClass: "badge-ghost" });
  } else if (props.matchStatus === "in_progress") {
    result.push({ label: "En juego", badgeClass: "badge-warning" });
  } else {
    result.push({ label: "Finalizado", badgeClass: "badge-neutral" });
  }

  if (props.predictedHomeScore === null || props.predictedAwayScore === null) {
    result.push({ label: "Sin pick", badgeClass: "badge-ghost" });
    return result;
  }

  result.push({ label: "Con pick", badgeClass: "badge-info" });

  if (
    props.matchStatus !== "finished" ||
    props.officialHomeScore === null ||
    props.officialAwayScore === null
  ) {
    return result;
  }

  const isExact =
    props.predictedHomeScore === props.officialHomeScore &&
    props.predictedAwayScore === props.officialAwayScore;

  if (isExact) {
    result.push({ label: "Exacto", badgeClass: "badge-success" });
    return result;
  }

  const predictedOutcome = Math.sign(
    props.predictedHomeScore - props.predictedAwayScore,
  );
  const officialOutcome = Math.sign(
    props.officialHomeScore - props.officialAwayScore,
  );

  if (predictedOutcome === officialOutcome) {
    result.push({ label: "Acierta ganador", badgeClass: "badge-primary" });
  } else {
    result.push({ label: "Sin acierto", badgeClass: "badge-error" });
  }

  return result;
});

const baseBadgeClass = computed(() =>
  props.compact ? "badge badge-xs sm:badge-sm" : "badge badge-sm",
);
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <span
      v-for="tag in tags"
      :key="tag.label"
      :class="[baseBadgeClass, tag.badgeClass]"
    >
      {{ tag.label }}
    </span>
  </div>
</template>
