<script setup lang="ts">
import { resolveTeamCode, teamFlagEmojiFromCode } from "~/utils/teamMeta";

type MatchStatus = "pending" | "in_progress" | "finished";

type PredictionMatchRow = {
  id: string;
  stage: string;
  status: MatchStatus;
  match_time: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  home_team_code?: string | null;
  away_team_code?: string | null;
  home_team_logo_url?: string | null;
  away_team_logo_url?: string | null;
};

type PredictionRow = {
  id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  points_earned: number;
  created_at?: string | null;
  hasPrediction: boolean;
  match: PredictionMatchRow | null;
};

const props = withDefaults(
  defineProps<{
    rows: PredictionRow[];
    pickHeader?: string;
    compact?: boolean;
    showWinnerColumn?: boolean;
    showPredictionExplanation?: boolean;
    showPointsBreakdown?: boolean;
    correctOutcomePoints?: number;
    kickoffDateStyle?: "short" | "medium" | "long" | "full";
    resolveTeamDisplayName?: (teamName: string | null | undefined) => string;
    resolveTeamLogoUrl?: (teamName: string | null | undefined) => string | null;
    resolveTeamFlagIconClass?: (
      teamName: string | null | undefined,
    ) => string | null;
    resolveTeamFlagEmoji?: (teamName: string | null | undefined) => string;
  }>(),
  {
    pickHeader: "Tu prediccion",
    compact: false,
    showWinnerColumn: false,
    showPredictionExplanation: false,
    showPointsBreakdown: false,
    correctOutcomePoints: 1,
    kickoffDateStyle: "short",
    resolveTeamDisplayName: undefined,
    resolveTeamLogoUrl: undefined,
    resolveTeamFlagIconClass: undefined,
    resolveTeamFlagEmoji: undefined,
  },
);

const stageLabel = (stage: string) => stage.replaceAll("_", " ").toUpperCase();

const kickoffText = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: props.kickoffDateStyle,
    timeStyle: "short",
  });

const flagIconClassFromCode = (code: string | null | undefined) => {
  const normalized = (code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `fi fi-${normalized}` : null;
};

const displayTeamName = (teamName: string | null | undefined) => {
  if (props.resolveTeamDisplayName) {
    return props.resolveTeamDisplayName(teamName);
  }

  return (teamName || "").trim() || "-";
};

const matchTeamLogoUrl = (
  match: PredictionMatchRow | null,
  side: "home" | "away",
) => {
  if (!match) {
    return null;
  }

  const inMatch =
    side === "home" ? match.home_team_logo_url : match.away_team_logo_url;

  if (inMatch) {
    return inMatch;
  }

  if (!props.resolveTeamLogoUrl) {
    return null;
  }

  const teamName = side === "home" ? match.home_team : match.away_team;
  return props.resolveTeamLogoUrl(teamName) || null;
};

const matchTeamFlagIconClass = (
  match: PredictionMatchRow | null,
  side: "home" | "away",
) => {
  if (!match) {
    return null;
  }

  const code = side === "home" ? match.home_team_code : match.away_team_code;
  const fromCode = flagIconClassFromCode(code);

  if (fromCode) {
    return fromCode;
  }

  const teamName = side === "home" ? match.home_team : match.away_team;

  if (props.resolveTeamFlagIconClass) {
    const fromResolver = props.resolveTeamFlagIconClass(teamName);

    if (fromResolver) {
      return fromResolver;
    }
  }

  return flagIconClassFromCode(resolveTeamCode(teamName));
};

const matchTeamFlag = (
  match: PredictionMatchRow | null,
  side: "home" | "away",
) => {
  if (!match) {
    return "";
  }

  const teamName = side === "home" ? match.home_team : match.away_team;

  if (props.resolveTeamFlagEmoji) {
    return props.resolveTeamFlagEmoji(teamName);
  }

  const code =
    (side === "home" ? match.home_team_code : match.away_team_code) ||
    resolveTeamCode(teamName);

  return teamFlagEmojiFromCode(code);
};

const resolveOutcome = (home: number, away: number) => {
  if (home > away) {
    return "home";
  }

  if (home < away) {
    return "away";
  }

  return "draw";
};

const predictionText = (row: PredictionRow) => {
  if (!row.match) {
    return "Prediccion guardada";
  }

  if (row.home_score === null || row.away_score === null) {
    return "Sin pick guardado";
  }

  if (row.home_score > row.away_score) {
    return `Gana ${displayTeamName(row.match.home_team)}`;
  }

  if (row.home_score < row.away_score) {
    return `Gana ${displayTeamName(row.match.away_team)}`;
  }

  return "Empate";
};

const officialResultText = (match: PredictionMatchRow | null) => {
  if (!match || match.home_score === null || match.away_score === null) {
    return "Sin resultado oficial";
  }

  if (match.home_score > match.away_score) {
    return `Gana ${displayTeamName(match.home_team)}`;
  }

  if (match.home_score < match.away_score) {
    return `Gana ${displayTeamName(match.away_team)}`;
  }

  return "Empate";
};

const winnerFromScore = (
  homeScore: number | null | undefined,
  awayScore: number | null | undefined,
  homeTeam: string | null | undefined,
  awayTeam: string | null | undefined,
) => {
  if (homeScore === null || homeScore === undefined) {
    return "Pendiente";
  }

  if (awayScore === null || awayScore === undefined) {
    return "Pendiente";
  }

  if (homeScore === awayScore) {
    return "Empate";
  }

  return homeScore > awayScore
    ? displayTeamName(homeTeam)
    : displayTeamName(awayTeam);
};

const pickWinnerText = (row: PredictionRow) => {
  if (row.home_score === null || row.away_score === null) {
    return "Sin pick";
  }

  return winnerFromScore(
    row.home_score,
    row.away_score,
    row.match?.home_team,
    row.match?.away_team,
  );
};

const officialWinnerText = (row: PredictionRow) => {
  return winnerFromScore(
    row.match?.home_score,
    row.match?.away_score,
    row.match?.home_team,
    row.match?.away_team,
  );
};

const pointBreakdownText = (row: PredictionRow) => {
  if (!props.showPointsBreakdown) {
    return "";
  }

  if (
    !row.match ||
    row.match.status !== "finished" ||
    row.home_score === null ||
    row.away_score === null ||
    row.match.home_score === null ||
    row.match.away_score === null
  ) {
    return "";
  }

  const points = Number(row.points_earned ?? 0);

  if (points <= 0) {
    return "Sin puntos";
  }

  const isExact =
    row.home_score === row.match.home_score &&
    row.away_score === row.match.away_score;

  if (!isExact) {
    return `+${points} por pick acertado`;
  }

  const outcomePart = Math.min(points, Math.max(0, props.correctOutcomePoints));
  const bonusPart = Math.max(0, points - outcomePart);

  if (bonusPart <= 0) {
    return `+${points} por marcador exacto`;
  }

  return `+${outcomePart} pick +${bonusPart} exacto`;
};
</script>

<template>
  <div
    class="overflow-x-auto rounded-2xl border border-base-300 bg-base-100/70"
  >
    <table class="table min-w-full text-sm">
      <thead
        class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
      >
        <tr>
          <th class="px-4 py-3">Partido</th>
          <th class="px-4 py-3">{{ pickHeader }}</th>
          <th class="px-4 py-3">Resultado</th>
          <th v-if="showWinnerColumn" class="px-4 py-3">Ganador</th>
          <th class="px-4 py-3">Estado</th>
          <th class="px-4 py-3">Puntos</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          class="border-t border-base-300 align-top"
        >
          <td class="px-4 py-3">
            <p class="text-base-content/70 text-xs">
              {{ row.match ? stageLabel(row.match.stage) : "-" }}
            </p>
            <div class="mt-1 flex items-center gap-2">
              <img
                v-if="matchTeamLogoUrl(row.match, 'home')"
                :src="matchTeamLogoUrl(row.match, 'home') || undefined"
                :alt="`Escudo de ${displayTeamName(row.match?.home_team)}`"
                class="h-5 w-5 rounded-full border border-base-300 object-cover"
                loading="lazy"
              />
              <span
                v-else-if="matchTeamFlagIconClass(row.match, 'home')"
                :class="matchTeamFlagIconClass(row.match, 'home') || undefined"
                class="inline-block h-4 w-5 rounded-[999px]"
                :title="`Bandera de ${displayTeamName(row.match?.home_team)}`"
                aria-hidden="true"
              />
              <span v-else class="text-base">{{
                matchTeamFlag(row.match, "home")
              }}</span>
              <span>{{ displayTeamName(row.match?.home_team) }}</span>

              <span class="text-base-content/70">vs</span>

              <img
                v-if="matchTeamLogoUrl(row.match, 'away')"
                :src="matchTeamLogoUrl(row.match, 'away') || undefined"
                :alt="`Escudo de ${displayTeamName(row.match?.away_team)}`"
                class="h-5 w-5 rounded-full border border-base-300 object-cover"
                loading="lazy"
              />
              <span
                v-else-if="matchTeamFlagIconClass(row.match, 'away')"
                :class="matchTeamFlagIconClass(row.match, 'away') || undefined"
                class="inline-block h-4 w-5 rounded-[999px]"
                :title="`Bandera de ${displayTeamName(row.match?.away_team)}`"
                aria-hidden="true"
              />
              <span v-else class="text-base">{{
                matchTeamFlag(row.match, "away")
              }}</span>
              <span>{{ displayTeamName(row.match?.away_team) }}</span>
            </div>
            <p class="text-base-content/70 mt-1 text-xs">
              {{ row.match ? kickoffText(row.match.match_time) : "-" }}
            </p>
          </td>

          <td class="px-4 py-3 font-semibold">
            <p v-if="row.hasPrediction">
              {{ row.home_score }} : {{ row.away_score }}
            </p>
            <p v-else class="text-base-content/70">Sin pick</p>
            <p
              v-if="showPredictionExplanation"
              class="text-base-content/70 mt-1 text-xs font-normal"
            >
              {{ predictionText(row) }}
            </p>
          </td>

          <td class="px-4 py-3">
            <span
              v-if="
                row.match?.home_score !== null && row.match?.away_score !== null
              "
            >
              {{ row.match?.home_score }} : {{ row.match?.away_score }}
            </span>
            <span v-else class="text-base-content/70">Pendiente</span>
            <p
              class="text-base-content/70 mt-1 text-xs"
              v-if="
                row.match?.home_score !== null && row.match?.away_score !== null
              "
            >
              {{ officialResultText(row.match) }}
            </p>
          </td>

          <td v-if="showWinnerColumn" class="px-4 py-3">
            <p class="text-xs text-base-content/70">
              Pick: {{ pickWinnerText(row) }}
            </p>
            <p class="text-xs text-base-content/70">
              Oficial: {{ officialWinnerText(row) }}
            </p>
          </td>

          <td class="px-4 py-3">
            <DashboardPredictionStatusTags
              :compact="compact"
              :match-status="row.match?.status ?? null"
              :predicted-home-score="row.home_score"
              :predicted-away-score="row.away_score"
              :official-home-score="row.match?.home_score ?? null"
              :official-away-score="row.match?.away_score ?? null"
            />
          </td>

          <td class="text-warning px-4 py-3 font-semibold">
            <p>{{ row.points_earned }}</p>
            <p
              v-if="pointBreakdownText(row)"
              class="text-base-content/70 mt-1 text-xs font-normal"
            >
              {{ pointBreakdownText(row) }}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
