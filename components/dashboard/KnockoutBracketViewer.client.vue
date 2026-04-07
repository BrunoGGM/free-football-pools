<script setup lang="ts">
import type { MatchItem } from "~/composables/useMatchesRealtime";
import "brackets-viewer/dist/brackets-viewer.min.css";
import viewerScriptUrl from "brackets-viewer/dist/brackets-viewer.min.js?url";

type ViewerStatus = 0 | 1 | 2 | 3 | 4 | 5;
type ViewerResult = "win" | "draw" | "loss";

interface ViewerParticipant {
  id: number;
  tournament_id: number;
  name: string;
}

interface ViewerMatch {
  id: number;
  number: number;
  stage_id: number;
  group_id: number;
  round_id: number;
  child_count: number;
  status: ViewerStatus;
  opponent1: {
    id: number | null;
    score?: number;
    result?: ViewerResult;
  } | null;
  opponent2: {
    id: number | null;
    score?: number;
    result?: ViewerResult;
  } | null;
}

interface ViewerStage {
  id: number;
  tournament_id: number;
  name: string;
  type: "single_elimination";
  number: number;
  settings: {
    size: number;
    seedOrdering: ["inner_outer"];
    consolationFinal: boolean;
    matchesChildCount: 0;
  };
}

const props = defineProps<{
  matches: MatchItem[];
}>();

const containerId = "eliminatorias-bracket-viewer";
const mounted = ref(false);
const viewerScriptId = "brackets-viewer-runtime-script";
let viewerScriptPromise: Promise<void> | null = null;

const ensureViewerScriptLoaded = async () => {
  if (process.server) {
    return;
  }

  const runtimeWindow = window as Window & {
    bracketsViewer?: {
      render: (data: any, config?: Record<string, unknown>) => Promise<void>;
    };
  };

  if (runtimeWindow.bracketsViewer?.render) {
    return;
  }

  if (viewerScriptPromise) {
    await viewerScriptPromise;
    return;
  }

  viewerScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      viewerScriptId,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar brackets-viewer.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = viewerScriptId;
    script.src = viewerScriptUrl;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("No se pudo cargar brackets-viewer.")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  await viewerScriptPromise;
};

const stageToRoundId: Record<string, number> = {
  round_32: 0,
  round_16: 1,
  quarter_final: 2,
  semi_final: 3,
  final: 4,
  third_place: 5,
};

const stageToGroupId: Record<string, number> = {
  round_32: 0,
  round_16: 0,
  quarter_final: 0,
  semi_final: 0,
  final: 0,
  third_place: 1,
};

const stageOrder = [
  "round_32",
  "round_16",
  "quarter_final",
  "semi_final",
  "final",
  "third_place",
];

const matchStatusToViewer = (status: MatchItem["status"]): ViewerStatus => {
  if (status === "finished") {
    return 4;
  }

  if (status === "in_progress") {
    return 3;
  }

  return 2;
};

const getOpponentResult = (
  score: number | null,
  otherScore: number | null,
): ViewerResult | undefined => {
  if (score === null || otherScore === null) {
    return undefined;
  }

  if (score > otherScore) {
    return "win";
  }

  if (score < otherScore) {
    return "loss";
  }

  return "draw";
};

const sortedMatches = computed(() => {
  const items = [...props.matches];

  items.sort((a, b) => {
    const stageDiff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);

    if (stageDiff !== 0) {
      return stageDiff;
    }

    const timeDiff =
      new Date(a.match_time).getTime() - new Date(b.match_time).getTime();

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return a.id.localeCompare(b.id);
  });

  return items;
});

const viewerData = computed(() => {
  const participantsByName = new Map<string, ViewerParticipant>();
  let participantId = 1;

  for (const match of sortedMatches.value) {
    const names = [match.home_team.trim(), match.away_team.trim()];

    for (const name of names) {
      if (!name) {
        continue;
      }

      if (!participantsByName.has(name)) {
        participantsByName.set(name, {
          id: participantId,
          tournament_id: 1,
          name,
        });
        participantId += 1;
      }
    }
  }

  const participants = [...participantsByName.values()];

  const matchesByStage = new Map<string, MatchItem[]>();
  for (const stage of stageOrder) {
    matchesByStage.set(stage, []);
  }

  for (const match of sortedMatches.value) {
    if (!matchesByStage.has(match.stage)) {
      continue;
    }

    matchesByStage.get(match.stage)?.push(match);
  }

  const viewerMatches: ViewerMatch[] = [];
  let viewerMatchId = 1;

  for (const stage of stageOrder) {
    const list = matchesByStage.get(stage) || [];

    for (const [index, match] of list.entries()) {
      const homeParticipant =
        participantsByName.get(match.home_team.trim()) || null;
      const awayParticipant =
        participantsByName.get(match.away_team.trim()) || null;

      viewerMatches.push({
        id: viewerMatchId,
        number: index + 1,
        stage_id: 1,
        group_id: stageToGroupId[stage] ?? 0,
        round_id: stageToRoundId[stage] ?? 0,
        child_count: 0,
        status: matchStatusToViewer(match.status),
        opponent1: homeParticipant
          ? {
              id: homeParticipant.id,
              score: match.home_score ?? undefined,
              result: getOpponentResult(match.home_score, match.away_score),
            }
          : null,
        opponent2: awayParticipant
          ? {
              id: awayParticipant.id,
              score: match.away_score ?? undefined,
              result: getOpponentResult(match.away_score, match.home_score),
            }
          : null,
      });

      viewerMatchId += 1;
    }
  }

  const stage: ViewerStage = {
    id: 1,
    tournament_id: 1,
    name: "Mundial 2026",
    type: "single_elimination",
    number: 1,
    settings: {
      size: 32,
      seedOrdering: ["inner_outer"],
      consolationFinal: true,
      matchesChildCount: 0,
    },
  };

  return {
    stages: [stage],
    matches: viewerMatches,
    matchGames: [],
    participants,
  };
});

const renderBracket = async () => {
  if (!mounted.value || process.server) {
    return;
  }

  await ensureViewerScriptLoaded();

  const runtimeWindow = window as Window & {
    bracketsViewer?: {
      render: (data: any, config?: Record<string, unknown>) => Promise<void>;
    };
  };

  if (!runtimeWindow.bracketsViewer?.render) {
    return;
  }

  await runtimeWindow.bracketsViewer.render(viewerData.value, {
    clear: true,
    selector: `#${containerId}`,
    showSlotsOrigin: false,
    participantOriginPlacement: "none",
    customRoundName: (info: {
      groupType: string;
      roundNumber: number;
      finalType?: string;
    }) => {
      if (info.groupType === "single_bracket") {
        const names: Record<number, string> = {
          1: "Dieciseisavos",
          2: "Octavos",
          3: "Cuartos",
          4: "Semifinal",
          5: "Final",
        };

        return names[info.roundNumber] ?? `Ronda ${info.roundNumber}`;
      }

      if (info.groupType === "final-group") {
        if (info.finalType === "consolation_final") {
          return "Tercer lugar";
        }

        return "Final";
      }

      return "";
    },
  });
};

onMounted(async () => {
  mounted.value = true;
  await renderBracket();
});

watch(
  viewerData,
  async () => {
    await renderBracket();
  },
  { deep: true },
);
</script>

<template>
  <article
    class="bracket-shell rounded-2xl border border-base-300 bg-base-200/70 p-3 md:p-5"
  >
    <div :id="containerId" class="brackets-viewer" />
  </article>
</template>

<style scoped>
.bracket-shell {
  background:
    radial-gradient(
      circle at 15% 10%,
      color-mix(in oklab, var(--color-primary) 14%, transparent),
      transparent 46%
    ),
    radial-gradient(
      circle at 85% 80%,
      color-mix(in oklab, var(--color-base-content) 10%, transparent),
      transparent 42%
    ),
    linear-gradient(
      180deg,
      color-mix(in oklab, var(--color-base-200) 85%, transparent),
      color-mix(in oklab, var(--color-base-300) 90%, transparent)
    );
}

.bracket-shell :deep(.brackets-viewer) {
  --match-background: var(--color-base-100);
  --match-color: var(--color-base-content);
  --match-border: var(--color-base-300);
  --match-hover-background: var(--color-base-200);
  --match-round-margin: 1.4rem;
  --participant-background: var(--color-base-100);
  --participant-color: var(--color-base-content);
  --participant-hover-background: var(--color-base-200);
  --participant-border: var(--color-base-300);
  --connector-color: color-mix(
    in oklab,
    var(--color-base-content) 45%,
    transparent
  );
  --hint-color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
}

.bracket-shell :deep(.stage-header) {
  color: var(--color-primary);
}

.bracket-shell :deep(.round-header) {
  color: var(--color-base-content);
}
</style>
