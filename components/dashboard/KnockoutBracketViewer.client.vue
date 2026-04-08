<script setup lang="ts">
import type { MatchItem } from "~/composables/useMatchesRealtime";
import {
  normalizeTeamKey,
  resolveTeamCode,
  teamFlagEmojiFromCode,
} from "~/utils/teamMeta";
import "brackets-viewer/dist/brackets-viewer.min.css";
import "flag-icons/css/flag-icons.min.css";
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

const bracketMatchOrderByStage: Record<string, number[]> = {
  // Este orden alinea el viewer con los seeds W/L definidos en M73-M104.
  round_32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  round_16: [89, 90, 93, 94, 91, 92, 95, 96],
  quarter_final: [97, 98, 99, 100],
  semi_final: [101, 102],
  final: [104],
  third_place: [103],
};

interface TeamVisualInfo {
  code: string | null;
  flagIconClass: string | null;
  flag: string;
  logoUrl: string | null;
}

const flagIconClassFromCode = (code: string | null) => {
  const normalized = (code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `fi fi-${normalized}` : null;
};

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
  status: MatchItem["status"],
  score: number | null,
  otherScore: number | null,
): ViewerResult | undefined => {
  if (status !== "finished") {
    return undefined;
  }

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

    const stageBracketOrder = bracketMatchOrderByStage[a.stage] || [];
    const aBracketNo = Number(a.bracket_match_no || 0);
    const bBracketNo = Number(b.bracket_match_no || 0);
    const aBracketIdx = stageBracketOrder.indexOf(aBracketNo);
    const bBracketIdx = stageBracketOrder.indexOf(bBracketNo);

    if (aBracketIdx >= 0 && bBracketIdx >= 0 && aBracketIdx !== bBracketIdx) {
      return aBracketIdx - bBracketIdx;
    }

    if (aBracketNo > 0 && bBracketNo > 0 && aBracketNo !== bBracketNo) {
      return aBracketNo - bBracketNo;
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

const teamVisualByNameKey = computed(() => {
  const visuals = new Map<string, TeamVisualInfo>();

  for (const match of sortedMatches.value) {
    const sides = [
      {
        name: match.home_team,
        code: match.home_team_code,
        logoUrl: match.home_team_logo_url,
      },
      {
        name: match.away_team,
        code: match.away_team_code,
        logoUrl: match.away_team_logo_url,
      },
    ];

    for (const side of sides) {
      const name = side.name.trim();
      const key = normalizeTeamKey(name);

      if (!key) {
        continue;
      }

      const resolvedCode = side.code || resolveTeamCode(name);
      const existing = visuals.get(key);

      if (existing) {
        const mergedCode = existing.code || resolvedCode;

        visuals.set(key, {
          code: mergedCode,
          flagIconClass:
            existing.flagIconClass || flagIconClassFromCode(mergedCode),
          flag: existing.flag || teamFlagEmojiFromCode(mergedCode),
          logoUrl: existing.logoUrl || side.logoUrl || null,
        });
        continue;
      }

      visuals.set(key, {
        code: resolvedCode,
        flagIconClass: flagIconClassFromCode(resolvedCode),
        flag: teamFlagEmojiFromCode(resolvedCode),
        logoUrl: side.logoUrl || null,
      });
    }
  }

  return visuals;
});

const getTeamVisual = (teamName: string): TeamVisualInfo => {
  const key = normalizeTeamKey(teamName);

  if (!key) {
    return {
      code: null,
      flagIconClass: null,
      flag: teamFlagEmojiFromCode(null),
      logoUrl: null,
    };
  }

  const existing = teamVisualByNameKey.value.get(key);

  if (existing) {
    return existing;
  }

  const code = resolveTeamCode(teamName);

  return {
    code,
    flagIconClass: flagIconClassFromCode(code),
    flag: teamFlagEmojiFromCode(code),
    logoUrl: null,
  };
};

const enhanceBracketPresentation = () => {
  if (process.server) {
    return;
  }

  const root = document.getElementById(containerId);

  if (!root) {
    return;
  }

  const teamNameNodes =
    root.querySelectorAll<HTMLElement>(".participant .name");

  for (const node of teamNameNodes) {
    const teamName = (node.textContent || "").trim();

    if (!teamName) {
      continue;
    }

    const visual = getTeamVisual(teamName);
    const cacheKey = `${teamName}-${visual.code || "none"}-${
      visual.flagIconClass || "no-icon"
    }-${visual.logoUrl || "no-logo"}`;

    if (node.dataset.enhanced === cacheKey) {
      continue;
    }

    node.dataset.enhanced = cacheKey;
    node.textContent = "";

    const identity = document.createElement("span");
    identity.className = "team-identity";

    if (visual.logoUrl) {
      const logo = document.createElement("img");
      logo.className = "team-logo-chip";
      logo.src = visual.logoUrl;
      logo.alt = `Escudo ${teamName}`;
      logo.loading = "lazy";
      logo.decoding = "async";
      identity.appendChild(logo);
    } else if (visual.flagIconClass) {
      const flagIcon = document.createElement("span");
      flagIcon.className = `team-flag-icon ${visual.flagIconClass}`;
      flagIcon.setAttribute("aria-hidden", "true");
      identity.appendChild(flagIcon);
    } else {
      const flag = document.createElement("span");
      flag.className = "team-flag-chip";
      flag.textContent = visual.flag;
      identity.appendChild(flag);
    }

    const name = document.createElement("span");
    name.className = "team-name-label";
    name.textContent = teamName;

    const icon = document.createElement("span");
    icon.className = "team-icon-chip";
    icon.textContent = "⚽";
    icon.setAttribute("aria-hidden", "true");

    node.appendChild(identity);
    node.appendChild(name);
    node.appendChild(icon);
  }
};

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
              result: getOpponentResult(
                match.status,
                match.home_score,
                match.away_score,
              ),
            }
          : null,
        opponent2: awayParticipant
          ? {
              id: awayParticipant.id,
              score: match.away_score ?? undefined,
              result: getOpponentResult(
                match.status,
                match.away_score,
                match.home_score,
              ),
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
          1: "🧩 Dieciseisavos",
          2: "⚔️ Octavos",
          3: "🔥 Cuartos",
          4: "🚀 Semifinal",
          5: "🏆 Final",
        };

        return names[info.roundNumber] ?? `Ronda ${info.roundNumber}`;
      }

      if (info.groupType === "final-group") {
        if (info.finalType === "consolation_final") {
          return "🥉 Tercer lugar";
        }

        return "🏆 Final";
      }

      return "";
    },
  });

  requestAnimationFrame(() => {
    enhanceBracketPresentation();
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
    <header class="bracket-legend mb-4 flex flex-wrap items-center gap-2">
      <span class="bracket-chip">🏆 Final</span>
      <span class="bracket-chip">🥉 Tercer lugar</span>
      <span class="bracket-chip">⚽ Equipo clasificado</span>
      <span class="bracket-chip">🔥 Cruce decisivo</span>
    </header>

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
  border-color: color-mix(in oklab, var(--color-primary) 28%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, #fff 30%, transparent),
    0 24px 50px color-mix(in oklab, #000 26%, transparent);
}

.bracket-legend {
  gap: 0.45rem;
}

.bracket-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  border-radius: 999px;
  border: 1px solid color-mix(in oklab, var(--color-primary) 34%, transparent);
  padding: 0.28rem 0.62rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--color-base-content) 86%, #fff);
  background: linear-gradient(
    130deg,
    color-mix(in oklab, var(--color-primary) 22%, transparent),
    color-mix(in oklab, var(--color-warning) 20%, transparent)
  );
  box-shadow: 0 6px 16px color-mix(in oklab, #000 16%, transparent);
}

.bracket-shell :deep(.brackets-viewer) {
  --primary-background: transparent;
  --secondary-background: color-mix(
    in oklab,
    var(--color-base-300) 36%,
    transparent
  );
  --match-background: color-mix(
    in oklab,
    var(--color-base-100) 95%,
    transparent
  );
  --font-color: var(--color-base-content);
  --border-color: color-mix(
    in oklab,
    var(--color-base-content) 18%,
    transparent
  );
  --border-hover-color: color-mix(
    in oklab,
    var(--color-primary) 56%,
    transparent
  );
  --border-selected-color: color-mix(
    in oklab,
    var(--color-warning) 66%,
    transparent
  );
  --win-color: color-mix(in oklab, var(--color-success) 88%, #fff);
  --loss-color: color-mix(in oklab, var(--color-error) 88%, #fff);
  --label-color: color-mix(
    in oklab,
    var(--color-base-content) 58%,
    transparent
  );
  --connector-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
  --hint-color: color-mix(in oklab, var(--color-base-content) 74%, transparent);
  --match-width: clamp(196px, 24vw, 260px);
  --round-margin: clamp(1.1rem, 2.4vw, 2.1rem);
  --match-border-radius: 0.85rem;
  --match-horizontal-padding: 0.62rem;
  --match-vertical-padding: 0.52rem;
  --text-size: 13px;
  padding: 0.7rem 1rem 1.2rem;
  font-family: "Chakra Petch", sans-serif;
}

.bracket-shell :deep(.brackets-viewer h1) {
  margin-top: 0.4rem;
  margin-bottom: 1.1rem;
  font-size: clamp(1.55rem, 2.8vw, 2.2rem);
  letter-spacing: 0.02em;
  text-shadow: 0 0 12px
    color-mix(in oklab, var(--color-primary) 24%, transparent);
}

.bracket-shell :deep(.brackets-viewer h3) {
  border-radius: 0.65rem;
  border: 1px solid
    color-mix(in oklab, var(--color-base-content) 10%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--color-base-100) 95%, transparent),
    color-mix(in oklab, var(--color-base-300) 46%, transparent)
  );
  font-weight: 700;
  letter-spacing: 0.045em;
}

.bracket-shell :deep(.brackets-viewer .round) {
  animation: bracket-rise 420ms ease-out both;
}

.bracket-shell :deep(.brackets-viewer .round:nth-of-type(2)) {
  animation-delay: 70ms;
}

.bracket-shell :deep(.brackets-viewer .round:nth-of-type(3)) {
  animation-delay: 130ms;
}

.bracket-shell :deep(.brackets-viewer .round:nth-of-type(4)) {
  animation-delay: 190ms;
}

.bracket-shell :deep(.brackets-viewer .round:nth-of-type(5)) {
  animation-delay: 250ms;
}

.bracket-shell :deep(.brackets-viewer .match) {
  transition:
    transform 170ms ease,
    filter 170ms ease;
  filter: drop-shadow(0 8px 18px color-mix(in oklab, #000 14%, transparent));
}

.bracket-shell :deep(.brackets-viewer .match:hover) {
  transform: translateY(-2px);
  filter: drop-shadow(0 10px 22px color-mix(in oklab, #000 21%, transparent));
}

.bracket-shell :deep(.brackets-viewer .match.connect-next::after),
.bracket-shell :deep(.brackets-viewer .opponents.connect-previous::before) {
  opacity: 0.8;
  animation: connector-pulse 2.8s ease-in-out infinite;
}

.bracket-shell :deep(.brackets-viewer .opponents) {
  border-width: 1px;
  border-color: color-mix(in oklab, var(--color-base-content) 14%, transparent);
  background: linear-gradient(
    150deg,
    color-mix(in oklab, var(--color-base-100) 96%, transparent),
    color-mix(in oklab, var(--color-base-300) 42%, transparent)
  );
  backdrop-filter: blur(3px);
}

.bracket-shell :deep(.brackets-viewer .participant) {
  align-items: center;
}

.bracket-shell :deep(.brackets-viewer .participant.win) {
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--color-success) 20%, transparent),
    color-mix(in oklab, var(--color-success) 7%, transparent)
  );
}

.bracket-shell :deep(.brackets-viewer .participant.loss) {
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--color-error) 12%, transparent),
    color-mix(in oklab, var(--color-base-300) 12%, transparent)
  );
}

.bracket-shell :deep(.brackets-viewer .participant .name) {
  display: flex;
  align-items: center;
  gap: 0.36rem;
  width: 82%;
}

.bracket-shell :deep(.brackets-viewer .participant .result) {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.bracket-shell :deep(.team-identity) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.1rem;
  height: 1.1rem;
  flex: 0 0 auto;
}

.bracket-shell :deep(.team-logo-chip) {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid color-mix(in oklab, var(--color-primary) 44%, transparent);
  box-shadow: 0 2px 8px color-mix(in oklab, #000 24%, transparent);
}

.bracket-shell :deep(.team-flag-chip) {
  font-size: 0.96rem;
  line-height: 1;
}

.bracket-shell :deep(.team-flag-icon) {
  width: 1.1rem;
  height: 1.1rem;
  display: inline-block;
  border-radius: 999px;
  box-shadow: 0 1px 6px color-mix(in oklab, #000 22%, transparent);
}

.bracket-shell :deep(.team-name-label) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bracket-shell :deep(.team-icon-chip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  font-size: 0.7rem;
  background: color-mix(in oklab, var(--color-warning) 24%, transparent);
  border: 1px solid color-mix(in oklab, var(--color-warning) 38%, transparent);
  box-shadow: 0 0 8px color-mix(in oklab, var(--color-warning) 24%, transparent);
}

@keyframes bracket-rise {
  from {
    opacity: 0;
    transform: translateY(7px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes connector-pulse {
  0%,
  100% {
    opacity: 0.42;
  }
  50% {
    opacity: 0.9;
  }
}

@media (max-width: 1024px) {
  .bracket-shell :deep(.brackets-viewer) {
    --match-width: 176px;
    --round-margin: 0.95rem;
    padding-inline: 0.45rem;
  }

  .bracket-chip {
    font-size: 0.63rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bracket-shell :deep(.brackets-viewer .round),
  .bracket-shell :deep(.brackets-viewer .match.connect-next::after),
  .bracket-shell :deep(.brackets-viewer .opponents.connect-previous::before) {
    animation: none !important;
  }

  .bracket-shell :deep(.brackets-viewer .match) {
    transition: none !important;
  }
}

.bracket-shell :deep(.stage-header) {
  color: var(--color-primary);
}

.bracket-shell :deep(.round-header) {
  color: var(--color-base-content);
}
</style>
