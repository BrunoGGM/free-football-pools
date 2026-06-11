import { resolveTeamCode, teamFlagEmojiFromCode } from "~/utils/teamMeta";

type MatchStatus = "pending" | "in_progress" | "finished";

interface PrintableMatch {
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
}

interface PrintablePrediction {
  id: string;
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  hasPrediction: boolean;
  match: PrintableMatch | null;
}

export interface PrintableQuinielaMeta {
  name: string;
  logoUrl?: string | null;
  startDate?: string | null;
  accessCode?: string | null;
  predictedChampion?: string | null;
}

export type PrintQuinielaMode = "with-picks" | "blank";

interface BuildPrintableOptions {
  quiniela: PrintableQuinielaMeta;
  username: string;
  predictions: PrintablePrediction[];
  mode: PrintQuinielaMode;
}

const STAGE_LABELS: Record<string, string> = {
  group_stage: "Fase de grupos",
  round_32: "Dieciseisavos de final",
  round_16: "Octavos de final",
  quarter_final: "Cuartos de final",
  semi_final: "Semifinales",
  third_place: "Tercer lugar",
  final: "Final",
};

const KNOCKOUT_STAGE_ORDER = [
  "round_32",
  "round_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
];

const isGroupStage = (stage: string) =>
  stage === "group_stage" || stage.startsWith("group_");

const stageSortRank = (stage: string) => {
  // Group stages always come first, ordered alphabetically (group_a, group_b...).
  if (isGroupStage(stage)) {
    return [0, stage] as const;
  }

  const knockoutIndex = KNOCKOUT_STAGE_ORDER.indexOf(stage);
  return [1, String(knockoutIndex === -1 ? 99 : knockoutIndex)] as const;
};

const escapeHtml = (value: string | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stageLabel = (stage: string) => {
  if (STAGE_LABELS[stage]) {
    return STAGE_LABELS[stage];
  }

  const groupMatch = /^group_([a-z])$/.exec(stage);

  if (groupMatch) {
    return `Grupo ${groupMatch[1].toUpperCase()}`;
  }

  return stage.replaceAll("_", " ").toUpperCase();
};

const kickoffText = (value: string | null | undefined) => {
  if (!value) {
    return "Por definir";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Por definir";
  }

  const day = date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
  const time = date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${escapeHtml(day)}<br />${escapeHtml(time)}`;
};

const teamFlagEmoji = (
  name: string,
  code: string | null | undefined,
) => teamFlagEmojiFromCode(code || resolveTeamCode(name));

const teamAbbreviation = (
  name: string,
  code: string | null | undefined,
) => {
  const resolved = (code || resolveTeamCode(name) || "").trim().toUpperCase();

  if (/^[A-Z]{2,3}$/.test(resolved)) {
    return resolved;
  }

  const cleaned = (name || "").trim();

  if (!cleaned) {
    return "?";
  }

  return cleaned.slice(0, 3).toUpperCase();
};

const teamCell = (
  name: string,
  code: string | null | undefined,
  logoUrl: string | null | undefined,
  align: "left" | "right",
) => {
  const abbr = escapeHtml(teamAbbreviation(name, code));
  const fullName = escapeHtml((name || "").trim() || "Por definir");
  const flag = logoUrl
    ? `<img class="team-logo" src="${escapeHtml(logoUrl)}" alt="" />`
    : `<span class="team-flag">${teamFlagEmoji(name, code)}</span>`;

  if (align === "right") {
    return `<span class="team team-right" title="${fullName}"><span class="team-name">${abbr}</span>${flag}</span>`;
  }

  return `<span class="team team-left" title="${fullName}">${flag}<span class="team-name">${abbr}</span></span>`;
};

const scoreBox = (value: number | null, showValue: boolean) => {
  const display = showValue && value !== null ? escapeHtml(String(value)) : "";
  return `<span class="score-box">${display}</span>`;
};

const buildMatchRow = (
  prediction: PrintablePrediction,
  mode: PrintQuinielaMode,
) => {
  const match = prediction.match;

  if (!match) {
    return "";
  }

  const showValue = mode === "with-picks" && prediction.hasPrediction;

  return `
    <div class="match-row">
      <div class="match-time">${kickoffText(match.match_time)}</div>
      <div class="match-teams">
        ${teamCell(match.home_team, match.home_team_code, match.home_team_logo_url, "right")}
        <div class="score-wrap">
          ${scoreBox(prediction.home_score, showValue)}
          <span class="score-sep">-</span>
          ${scoreBox(prediction.away_score, showValue)}
        </div>
        ${teamCell(match.away_team, match.away_team_code, match.away_team_logo_url, "left")}
      </div>
    </div>`;
};

const buildStageSection = (
  stage: string,
  rows: PrintablePrediction[],
  mode: PrintQuinielaMode,
) => {
  const matchesHtml = rows
    .map((row) => buildMatchRow(row, mode))
    .filter(Boolean)
    .join("");

  if (!matchesHtml) {
    return "";
  }

  return `
    <section class="stage">
      <h2 class="stage-title">${escapeHtml(stageLabel(stage))}</h2>
      <div class="stage-matches">${matchesHtml}</div>
    </section>`;
};

const buildDocument = ({
  quiniela,
  username,
  predictions,
  mode,
}: BuildPrintableOptions) => {
  const groups = new Map<string, PrintablePrediction[]>();

  for (const prediction of predictions) {
    const stage = prediction.match?.stage || "group_stage";
    const list = groups.get(stage) ?? [];
    list.push(prediction);
    groups.set(stage, list);
  }

  const orderedStages = [...groups.keys()].sort((a, b) => {
    const [groupA, keyA] = stageSortRank(a);
    const [groupB, keyB] = stageSortRank(b);

    if (groupA !== groupB) {
      return groupA - groupB;
    }

    return keyA.localeCompare(keyB);
  });

  const stagesHtml = orderedStages
    .map((stage) => buildStageSection(stage, groups.get(stage) ?? [], mode))
    .filter(Boolean)
    .join("");

  const generatedAt = new Date().toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const modeBadge =
    mode === "with-picks" ? "Con mis picks" : "Plantilla en blanco";

  const championPick =
    mode === "with-picks" && quiniela.predictedChampion
      ? `<div class="champion-pick">
           <span class="champion-flag">${teamFlagEmoji(
        quiniela.predictedChampion,
        resolveTeamCode(quiniela.predictedChampion),
      )}</span>
           <span><span class="champion-label">Campeon</span><br />${escapeHtml(
        quiniela.predictedChampion,
      )}</span>
         </div>`
      : mode === "blank"
        ? `<div class="champion-pick champion-blank">
             <span class="champion-line"></span>
             <span class="champion-label">Campeon</span>
           </div>`
        : "";

  const logoHtml = quiniela.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(quiniela.logoUrl)}" alt="" />`
    : `<div class="brand-logo brand-logo-fallback">⚽</div>`;

  const accessCode = quiniela.accessCode
    ? `<span class="meta-chip">Codigo: ${escapeHtml(quiniela.accessCode)}</span>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quiniela - ${escapeHtml(quiniela.name)}</title>
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/flag-icons@7.5.0/css/flag-icons.min.css"
/>
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --accent: #16a34a;
    --accent-soft: #dcfce7;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: var(--ink);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 820px;
    margin: 0 auto;
    padding: 14px 18px 18px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--accent);
  }
  .brand-logo {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid var(--line);
    flex-shrink: 0;
  }
  .brand-logo-fallback {
    display: grid;
    place-content: center;
    font-size: 22px;
    background: var(--accent-soft);
    border-color: var(--accent-soft);
  }
  .header-info { flex: 1; min-width: 0; }
  .kicker {
    font-size: 9px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
    margin: 0;
  }
  .title {
    margin: 1px 0 0;
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
  }
  .meta {
    margin-top: 5px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .meta-chip {
    font-size: 9px;
    color: var(--muted);
    background: #f1f5f9;
    border-radius: 999px;
    padding: 2px 8px;
  }
  .meta-chip.mode {
    background: var(--accent-soft);
    color: #166534;
    font-weight: 700;
  }
  .player-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 10px 0 4px;
    padding: 8px 12px;
    background: #f8fafc;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .player-name {
    font-size: 14px;
    font-weight: 700;
  }
  .player-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
  }
  .champion-pick {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    text-align: right;
  }
  .champion-flag { font-size: 18px; }
  .champion-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 700;
  }
  .champion-blank { flex-direction: column; align-items: flex-end; gap: 2px; }
  .champion-line {
    display: block;
    width: 100px;
    border-bottom: 1.5px solid var(--ink);
    height: 14px;
  }
  .stage { margin-top: 10px; break-inside: avoid; }
  .stage-title {
    margin: 0 0 5px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fff;
    background: var(--accent);
    padding: 4px 9px;
    border-radius: 6px;
  }
  .stage-matches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 4px 8px;
  }
  .match-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border: 1px solid var(--line);
    border-radius: 7px;
    break-inside: avoid;
  }
  .match-time {
    width: 56px;
    flex-shrink: 0;
    font-size: 8px;
    color: var(--muted);
    text-transform: capitalize;
    line-height: 1.15;
  }
  .match-teams {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .team {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    min-width: 0;
  }
  .team-right { justify-content: flex-end; text-align: right; }
  .team-left { justify-content: flex-start; text-align: left; }
  .team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .team-flag { font-size: 15px; line-height: 1; }
  .team-logo {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--line);
    flex-shrink: 0;
  }
  .score-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .score-box {
    width: 20px;
    height: 20px;
    border: 1.4px solid var(--ink);
    border-radius: 5px;
    display: grid;
    place-content: center;
    font-size: 12px;
    font-weight: 800;
  }
  .score-sep { font-weight: 800; color: var(--muted); font-size: 11px; }
  .footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    font-size: 8px;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }
  @page {
    margin: 8mm 8mm;
  }
  @media print {
    .sheet { padding: 0; max-width: none; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="header">
      ${logoHtml}
      <div class="header-info">
        <p class="kicker">Quiniela Mundial 2026</p>
        <h1 class="title">${escapeHtml(quiniela.name)}</h1>
        <div class="meta">
          <span class="meta-chip mode">${escapeHtml(modeBadge)}</span>
          ${accessCode}
          <span class="meta-chip">Generado: ${escapeHtml(generatedAt)}</span>
        </div>
      </div>
    </header>

    <div class="player-bar">
      <div>
        <div class="player-label">Jugador</div>
        <div class="player-name">${escapeHtml(username)}</div>
      </div>
      ${championPick}
    </div>

    ${stagesHtml ||
    `<p style="color:var(--muted);font-size:13px;margin-top:24px;">Todavia no hay partidos programados para esta quiniela.</p>`
    }

    <footer class="footer">
      <span>Quiniela Mundial 2026</span>
      <span>${escapeHtml(username)} - ${escapeHtml(quiniela.name)}</span>
    </footer>
  </div>
</body>
</html>`;
};

export function usePrintableQuiniela() {
  const printQuiniela = (options: BuildPrintableOptions) => {
    if (!import.meta.client) {
      return false;
    }

    const html = buildDocument(options);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    };

    const triggerPrint = () => {
      const frameWindow = iframe.contentWindow;

      if (!frameWindow) {
        iframe.remove();
        return;
      }

      // Give the browser a moment to lay out fonts/flags before printing.
      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          // Ignore: some browsers throw if the user cancels quickly.
        }

        cleanup();
      }, 350);
    };

    iframe.addEventListener("load", triggerPrint, { once: true });

    const frameDoc =
      iframe.contentDocument || iframe.contentWindow?.document || null;

    if (!frameDoc) {
      iframe.remove();
      return false;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    return true;
  };

  return { printQuiniela };
}
