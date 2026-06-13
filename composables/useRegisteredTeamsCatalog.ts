import { normalizeTeamKey, resolveTeamCode } from "~/utils/teamMeta";

export interface RegisteredTeamCatalogItem {
  name: string;
  code: string | null;
  logo_url: string | null;
  team_key: string;
}

type RegisteredTeamsCachePayload = {
  cachedAt: number;
  teams: RegisteredTeamCatalogItem[];
};

const REGISTERED_TEAMS_CACHE_KEY = "registered-teams-catalog:v2";
const REGISTERED_TEAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const isFreshCache = (cachedAt: number) =>
  Number.isFinite(cachedAt) && Date.now() - cachedAt < REGISTERED_TEAMS_CACHE_TTL_MS;

const isPlaceholderTeamName = (value: string) => {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return true;
  }

  return (
    /^\d+[A-Z]$/.test(normalized) ||
    /^W\d+$/.test(normalized) ||
    /^L\d+$/.test(normalized) ||
    /^3RD\(.+\)$/.test(normalized) ||
    normalized.includes("WINNER") ||
    normalized.includes("LOSER")
  );
};

const upsertRegisteredTeamOption = (
  map: Map<string, RegisteredTeamCatalogItem>,
  payload: {
    name: string | null | undefined;
    code?: string | null;
    logo_url?: string | null;
    team_key?: string | null;
  },
) => {
  const name = String(payload.name || "").trim();

  if (!name || isPlaceholderTeamName(name)) {
    return;
  }

  const teamKey = payload.team_key?.trim() || normalizeTeamKey(name);

  if (!teamKey) {
    return;
  }

  const current = map.get(teamKey);

  map.set(teamKey, {
    name: current?.name || name,
    code: current?.code || payload.code || resolveTeamCode(name),
    logo_url: current?.logo_url || payload.logo_url || null,
    team_key: teamKey,
  });
};

export function useRegisteredTeamsCatalog() {
  const client = useSupabaseClient<any>();
  const teamsState = useState<RegisteredTeamCatalogItem[] | null>(
    "registered-teams-catalog-data",
    () => null,
  );
  const cachedAtState = useState<number | null>(
    "registered-teams-catalog-cached-at",
    () => null,
  );

  const readLocalCache = () => {
    if (!import.meta.client) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(REGISTERED_TEAMS_CACHE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as RegisteredTeamsCachePayload;

      if (!Array.isArray(parsed?.teams) || !isFreshCache(Number(parsed?.cachedAt))) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };

  const writeLocalCache = (teams: RegisteredTeamCatalogItem[]) => {
    if (!import.meta.client) {
      return;
    }

    try {
      const payload: RegisteredTeamsCachePayload = {
        cachedAt: Date.now(),
        teams,
      };

      window.localStorage.setItem(
        REGISTERED_TEAMS_CACHE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Ignore localStorage quota / private mode errors.
    }
  };

  const fetchRegisteredTeamsCatalog = async () => {
    const [profilesResult, matchesResult] = await Promise.all([
      client
        .from("team_profiles")
        .select("name, code, logo_url, team_key")
        .order("name", { ascending: true }),
      client
        .from("matches")
        .select(
          "home_team, away_team, home_team_code, away_team_code, home_team_logo_url, away_team_logo_url",
        ),
    ]);

    if (profilesResult.error && matchesResult.error) {
      return teamsState.value ?? [];
    }

    const teamMap = new Map<string, RegisteredTeamCatalogItem>();

    for (const team of (
      (profilesResult.data as RegisteredTeamCatalogItem[] | null) ?? []
    )) {
      upsertRegisteredTeamOption(teamMap, team);
    }

    for (const match of (
      (matchesResult.data as Array<{
        home_team: string | null;
        away_team: string | null;
        home_team_code: string | null;
        away_team_code: string | null;
        home_team_logo_url: string | null;
        away_team_logo_url: string | null;
      }> | null) ?? []
    )) {
      upsertRegisteredTeamOption(teamMap, {
        name: match.home_team,
        code: match.home_team_code,
        logo_url: match.home_team_logo_url,
      });
      upsertRegisteredTeamOption(teamMap, {
        name: match.away_team,
        code: match.away_team_code,
        logo_url: match.away_team_logo_url,
      });
    }

    const teams = [...teamMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );

    teamsState.value = teams;
    cachedAtState.value = Date.now();
    writeLocalCache(teams);
    return teams;
  };

  const loadRegisteredTeamsCatalog = async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);

    if (
      !force &&
      teamsState.value &&
      cachedAtState.value !== null &&
      isFreshCache(cachedAtState.value)
    ) {
      return teamsState.value;
    }

    if (!force) {
      const cached = readLocalCache();

      if (cached) {
        teamsState.value = cached.teams;
        cachedAtState.value = cached.cachedAt;
        return cached.teams;
      }
    }

    return await fetchRegisteredTeamsCatalog();
  };

  return {
    loadRegisteredTeamsCatalog,
  };
}