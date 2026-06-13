import { resolveTeamCode } from "~/utils/teamMeta";

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

const REGISTERED_TEAMS_CACHE_KEY = "registered-teams-catalog:v4";
const REGISTERED_TEAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const isFreshCache = (cachedAt: number) =>
  Number.isFinite(cachedAt) && Date.now() - cachedAt < REGISTERED_TEAMS_CACHE_TTL_MS;

const normalizeCountryCode = (
  code: string | null | undefined,
  teamName: string,
) => {
  const normalized = String(code || "").trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  return resolveTeamCode(teamName)?.toUpperCase() ?? null;
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
    const { data, error } = await client
      .from("team_profiles")
      .select("name, code, logo_url, team_key")
      .order("name", { ascending: true });

    if (error) {
      return teamsState.value ?? [];
    }

    const teams =
      (((data as RegisteredTeamCatalogItem[] | null) ?? [])
        .filter((team) => Boolean(team.name && team.team_key))
        .map((team) => ({
          ...team,
          code: normalizeCountryCode(team.code, team.name),
        })));

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