<script setup lang="ts">
import {
  normalizeTeamKey,
  resolveTeamCode,
  teamFlagEmojiFromCode,
} from "~/utils/teamMeta";
import "flag-icons/css/flag-icons.min.css";

definePageMeta({
  middleware: ["auth"],
});

interface TeamProfileOption {
  name: string;
  code: string | null;
  logo_url: string | null;
  team_key: string;
}

interface CustomPickRow {
  id: string;
  title: string;
  description: string | null;
  requires_text: boolean;
  requires_country: boolean;
  points: number;
  sort_order: number;
  locks_at: string | null;
}

interface CustomPickAnswerRow {
  id: string;
  custom_pick_id: string;
  answer_text: string | null;
  answer_country: string | null;
  is_correct: boolean;
}

interface CustomPickDraft {
  text: string;
  country: string;
  saving: boolean;
  message: string | null;
  error: string | null;
}

const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const { quiniela, activeQuinielaId, loadActiveQuiniela } = useActiveQuiniela();
const { emitChampionSaved } = useGameUx();

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const registeredTeams = ref<TeamProfileOption[]>([]);
const championBonusPoints = ref(10);

// Champion pick state
const championInput = ref("");
const championPickerOpen = ref(false);
const savingChampion = ref(false);
const championSaved = ref(false);
const championLockStartedAt = ref<string | null>(null);
let championSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Custom picks state
const customPicks = ref<CustomPickRow[]>([]);
const customAnswers = ref<Record<string, CustomPickAnswerRow>>({});
const customDrafts = ref<Record<string, CustomPickDraft>>({});
const customPicksSupported = ref(true);

const registeredTeamsMap = computed(() => {
  const map = new Map<string, TeamProfileOption>();

  for (const team of registeredTeams.value) {
    map.set(normalizeTeamKey(team.name), team);
    map.set(team.team_key, team);
  }

  return map;
});

const championOptions = computed(() => {
  const query = normalizeTeamKey(championInput.value.trim());

  if (!query) {
    return registeredTeams.value.slice(0, 12);
  }

  return registeredTeams.value
    .filter((team) => {
      const byName = normalizeTeamKey(team.name);
      return byName.includes(query) || team.team_key.includes(query);
    })
    .slice(0, 12);
});

const championSelectionLocked = computed(() => {
  const lockStartedAt = championLockStartedAt.value;

  if (!lockStartedAt) {
    return false;
  }

  const lockStartedAtMs = new Date(lockStartedAt).getTime();

  if (!Number.isFinite(lockStartedAtMs)) {
    return false;
  }

  return Date.now() >= lockStartedAtMs;
});

const kickoffText = (value: string) =>
  new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

const championLockText = computed(() => {
  if (!championSelectionLocked.value || !championLockStartedAt.value) {
    return "";
  }

  return `El pick de campeon quedo bloqueado desde ${kickoffText(championLockStartedAt.value)} porque ya inicio el primer partido de eliminatorias.`;
});

const getTeamInfo = (value: string | null) => {
  if (!value) {
    return null;
  }

  const exact = registeredTeamsMap.value.get(normalizeTeamKey(value));

  if (exact) {
    return {
      name: exact.name,
      code: exact.code,
      logoUrl: exact.logo_url,
    };
  }

  return {
    name: value,
    code: resolveTeamCode(value),
    logoUrl: null,
  };
};

const flagIconClassFromCode = (code: string | null | undefined) => {
  const normalized = (code || "").trim().toLowerCase();
  return /^[a-z]{2}$/.test(normalized) ? `fi fi-${normalized}` : null;
};

const teamFlag = (value: string | null) => {
  const info = getTeamInfo(value);
  return info ? teamFlagEmojiFromCode(info.code) : "";
};

const teamFlagIconClass = (value: string | null) => {
  const info = getTeamInfo(value);
  return flagIconClassFromCode(info?.code);
};

const teamDisplayName = (value: string | null) => {
  const info = getTeamInfo(value);
  return info?.name ?? "-";
};

const teamLogoUrl = (value: string | null) => {
  const info = getTeamInfo(value);
  return info?.logoUrl ?? null;
};

const selectedChampionInfo = computed(() =>
  getTeamInfo(championInput.value.trim() || null),
);

const teamOptionFlagIconClass = (team: TeamProfileOption) =>
  flagIconClassFromCode(team.code || resolveTeamCode(team.name));

const teamOptionFlag = (team: TeamProfileOption) =>
  teamFlagEmojiFromCode(team.code || resolveTeamCode(team.name));

const selectChampionFromList = (team: TeamProfileOption) => {
  if (championSelectionLocked.value) {
    return;
  }

  championInput.value = team.name;
  championPickerOpen.value = false;
};

const onChampionInputBlur = () => {
  setTimeout(() => {
    championPickerOpen.value = false;
  }, 120);
};

const resolveChampionFromRegisteredTeams = (input: string) => {
  const raw = input.trim();

  if (!raw) {
    return { matched: true, name: null as string | null };
  }

  const normalized = normalizeTeamKey(raw);
  const exact = registeredTeamsMap.value.get(normalized);

  if (exact) {
    return { matched: true, name: exact.name };
  }

  const startsWith = registeredTeams.value.filter((team) =>
    normalizeTeamKey(team.name).startsWith(normalized),
  );

  const firstMatch = startsWith.at(0);

  if (startsWith.length === 1 && firstMatch) {
    return { matched: true, name: firstMatch.name };
  }

  return { matched: false, name: raw };
};

const pickLocked = (pick: CustomPickRow) => {
  if (!pick.locks_at) {
    return false;
  }

  const lockMs = new Date(pick.locks_at).getTime();

  if (!Number.isFinite(lockMs)) {
    return false;
  }

  return Date.now() >= lockMs;
};

const pickStatusLabel = (pick: CustomPickRow) => {
  const answer = customAnswers.value[pick.id];

  if (answer?.is_correct) {
    return { label: `Ganador · +${pick.points} pts`, tone: "badge-success" };
  }

  if (answer) {
    return {
      label: "Pendiente de validar",
      tone: "badge-warning",
    };
  }

  if (pickLocked(pick)) {
    return { label: "Cerrado sin respuesta", tone: "badge-ghost" };
  }

  return { label: "Sin responder", tone: "badge-ghost" };
};

const sortedCustomPicks = computed(() =>
  customPicks.value
    .slice()
    .sort(
      (a, b) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
        a.title.localeCompare(b.title, "es", { sensitivity: "base" }),
    ),
);

const totalAdditionalPickPotentialPoints = computed(() =>
  sortedCustomPicks.value.reduce((total, pick) => total + Number(pick.points || 0), 0),
);

const answeredAdditionalPickCount = computed(() =>
  sortedCustomPicks.value.filter((pick) => {
    const answer = customAnswers.value[pick.id];
    return Boolean(
      (answer?.answer_text && answer.answer_text.trim()) ||
        (answer?.answer_country && answer.answer_country.trim()),
    );
  }).length,
);

const pendingAdditionalPickCount = computed(() =>
  Math.max(0, sortedCustomPicks.value.length - answeredAdditionalPickCount.value),
);

const pickCardClass = (pick: CustomPickRow) => {
  const tone = pickStatusLabel(pick).tone;

  if (tone === "badge-success") {
    return "border-success/30 bg-success/5";
  }

  if (tone === "badge-warning") {
    return "border-warning/30 bg-warning/5";
  }

  return "border-base-300 bg-base-100/70";
};

const customPickCards = computed(() =>
  sortedCustomPicks.value.map((pick) => ({
    pick,
    draft: customDrafts.value[pick.id] ?? buildDraft(pick),
  })),
);

const loadChampionLockStartedAt = async () => {
  if (!activeQuinielaId.value) {
    championLockStartedAt.value = null;
    return;
  }

  const firstKnockoutMatchResult = await client
    .from("matches")
    .select("match_time")
    .in("stage", [
      "round_32",
      "round_16",
      "quarter_final",
      "semi_final",
      "third_place",
      "final",
    ])
    .order("match_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstKnockoutMatchResult.error) {
    championLockStartedAt.value = null;
    return;
  }

  championLockStartedAt.value =
    (firstKnockoutMatchResult.data as { match_time?: string | null } | null)
      ?.match_time ?? null;
};

const loadRegisteredTeams = async () => {
  const { data, error } = await client
    .from("team_profiles")
    .select("name, code, logo_url, team_key")
    .order("name", { ascending: true });

  if (error) {
    return;
  }

  registeredTeams.value =
    (data as TeamProfileOption[] | null)?.filter((item) =>
      Boolean(item.name),
    ) ?? [];
};

const loadChampionPick = async () => {
  if (!activeQuinielaId.value || !user.value) {
    championInput.value = "";
    return;
  }

  const { data, error } = await client
    .from("quiniela_members")
    .select("predicted_champion")
    .eq("quiniela_id", activeQuinielaId.value)
    .eq("user_id", user.value.id)
    .maybeSingle();

  if (error) {
    return;
  }

  championInput.value =
    (data as { predicted_champion?: string | null } | null)
      ?.predicted_champion ?? "";
};

const loadChampionBonusPoints = async () => {
  if (!activeQuinielaId.value) {
    championBonusPoints.value = 10;
    return;
  }

  const { data, error } = await client
    .from("quiniela_rules")
    .select("champion_bonus_points")
    .eq("quiniela_id", activeQuinielaId.value)
    .maybeSingle();

  if (error) {
    championBonusPoints.value = 10;
    return;
  }

  championBonusPoints.value = Math.max(
    0,
    Number(
      (data as { champion_bonus_points?: number | null } | null)
        ?.champion_bonus_points ?? 10,
    ),
  );
};

const isMissingCustomPicksTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    message.includes("quiniela_custom_picks") ||
    message.includes("quiniela_custom_pick_answers")
  );
};

const buildDraft = (pick: CustomPickRow): CustomPickDraft => {
  const answer = customAnswers.value[pick.id];

  return {
    text: answer?.answer_text ?? "",
    country: answer?.answer_country ?? "",
    saving: false,
    message: null,
    error: null,
  };
};

const loadCustomPicks = async () => {
  if (!activeQuinielaId.value || !user.value) {
    customPicks.value = [];
    customAnswers.value = {};
    customDrafts.value = {};
    return;
  }

  const picksResult = await client
    .from("quiniela_custom_picks")
    .select(
      "id, title, description, requires_text, requires_country, points, sort_order, locks_at",
    )
    .eq("quiniela_id", activeQuinielaId.value)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (picksResult.error) {
    if (isMissingCustomPicksTableError(picksResult.error)) {
      customPicksSupported.value = false;
      return;
    }

    errorMessage.value = picksResult.error.message;
    return;
  }

  customPicksSupported.value = true;
  customPicks.value = (picksResult.data as CustomPickRow[] | null) ?? [];

  const answersResult = await client
    .from("quiniela_custom_pick_answers")
    .select("id, custom_pick_id, answer_text, answer_country, is_correct")
    .eq("quiniela_id", activeQuinielaId.value)
    .eq("user_id", user.value.id);

  const answersMap: Record<string, CustomPickAnswerRow> = {};

  if (!answersResult.error) {
    for (const answer of (answersResult.data as CustomPickAnswerRow[] | null) ??
      []) {
      answersMap[answer.custom_pick_id] = answer;
    }
  }

  customAnswers.value = answersMap;

  const drafts: Record<string, CustomPickDraft> = {};
  for (const pick of customPicks.value) {
    drafts[pick.id] = buildDraft(pick);
  }
  customDrafts.value = drafts;
};

const loadAll = async () => {
  if (!activeQuinielaId.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = null;

  await Promise.all([
    loadChampionLockStartedAt(),
    loadChampionBonusPoints(),
    loadRegisteredTeams(),
    loadChampionPick(),
  ]);

  await loadCustomPicks();

  loading.value = false;
};

const triggerChampionCelebration = () => {
  if (championSaveTimer) {
    clearTimeout(championSaveTimer);
  }

  championSaved.value = true;
  emitChampionSaved();

  championSaveTimer = setTimeout(() => {
    championSaved.value = false;
  }, 2300);
};

const saveChampion = async () => {
  if (!activeQuinielaId.value || !user.value) {
    return;
  }

  if (championSelectionLocked.value) {
    championPickerOpen.value = false;
    errorMessage.value =
      "El pick de campeon ya esta bloqueado porque inicio el primer partido de eliminatorias.";
    return;
  }

  savingChampion.value = true;
  errorMessage.value = null;

  const resolvedChampion = resolveChampionFromRegisteredTeams(
    championInput.value,
  );

  if (!resolvedChampion.matched) {
    savingChampion.value = false;
    errorMessage.value =
      "Selecciona un campeon de los equipos registrados para guardar tu pick.";
    return;
  }

  championInput.value = resolvedChampion.name ?? "";

  const { error } = await client
    .from("quiniela_members")
    .update({ predicted_champion: resolvedChampion.name })
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value);

  savingChampion.value = false;

  if (error) {
    championSaved.value = false;
    errorMessage.value = error.message;
    return;
  }

  triggerChampionCelebration();
};

const saveCustomPick = async (pick: CustomPickRow) => {
  if (!activeQuinielaId.value || !user.value) {
    return;
  }

  const draft = customDrafts.value[pick.id];

  if (!draft) {
    return;
  }

  draft.message = null;
  draft.error = null;

  if (pickLocked(pick)) {
    draft.error = "Este pick ya esta bloqueado.";
    return;
  }

  const answerText = pick.requires_text ? draft.text.trim() : null;
  const answerCountry = pick.requires_country ? draft.country.trim() : null;

  if (pick.requires_text && !answerText) {
    draft.error = "Escribe una respuesta.";
    return;
  }

  if (pick.requires_country && !answerCountry) {
    draft.error = "Selecciona un pais.";
    return;
  }

  draft.saving = true;

  const existing = customAnswers.value[pick.id];

  const payload = {
    custom_pick_id: pick.id,
    quiniela_id: activeQuinielaId.value,
    user_id: user.value.id,
    answer_text: answerText,
    answer_country: answerCountry,
  };

  const result = existing
    ? await client
        .from("quiniela_custom_pick_answers")
        .update({
          answer_text: answerText,
          answer_country: answerCountry,
        })
        .eq("id", existing.id)
        .select("id, custom_pick_id, answer_text, answer_country, is_correct")
        .single()
    : await client
        .from("quiniela_custom_pick_answers")
        .insert(payload)
        .select("id, custom_pick_id, answer_text, answer_country, is_correct")
        .single();

  draft.saving = false;

  if (result.error) {
    draft.error = result.error.message;
    return;
  }

  customAnswers.value = {
    ...customAnswers.value,
    [pick.id]: result.data as CustomPickAnswerRow,
  };
  draft.message = "Pick guardado.";
};

onMounted(() => {
  void (async () => {
    await loadActiveQuiniela();
    await loadAll();
  })();
});

watch(
  () => activeQuinielaId.value,
  () => {
    void (async () => {
      await loadActiveQuiniela();
      await loadAll();
    })();
  },
);

onBeforeUnmount(() => {
  if (championSaveTimer) {
    clearTimeout(championSaveTimer);
  }
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Partidos
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Picks adicionales</h1>
      </div>
      <button class="btn btn-outline btn-sm" @click="loadAll">Refrescar</button>
    </header>

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Activa una quiniela para registrar tus picks adicionales.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <template v-else>
      <article
        v-if="errorMessage"
        class="alert alert-error rounded-2xl text-sm"
      >
        {{ errorMessage }}
      </article>

      <article
        class="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-base-100/80 to-warning/10 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-primary text-xs uppercase tracking-[0.16em]">
              Resumen de picks
            </p>
            <h2 class="mt-1 text-2xl font-semibold text-base-content">
              Puedes ganar hasta {{ totalAdditionalPickPotentialPoints }} pts
            </h2>
            <p class="mt-2 text-sm text-base-content/70">
              Si aciertas todos los picks adicionales sumas
              {{ totalAdditionalPickPotentialPoints }} puntos. El campeon del
              mundo agrega {{ championBonusPoints }} puntos extra.
            </p>
          </div>

          <div class="grid gap-2 sm:grid-cols-3">
            <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
              <p class="text-xs uppercase tracking-[0.12em] text-base-content/60">
                Respondidos
              </p>
              <p class="mt-1 text-xl font-semibold text-base-content">
                {{ answeredAdditionalPickCount }}
              </p>
            </article>
            <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
              <p class="text-xs uppercase tracking-[0.12em] text-base-content/60">
                Pendientes
              </p>
              <p class="mt-1 text-xl font-semibold text-base-content">
                {{ pendingAdditionalPickCount }}
              </p>
            </article>
            <article class="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3 text-center">
              <p class="text-xs uppercase tracking-[0.12em] text-base-content/60">
                Picks activos
              </p>
              <p class="mt-1 text-xl font-semibold text-base-content">
                {{ sortedCustomPicks.length }}
              </p>
            </article>
          </div>
        </div>
      </article>

      <!-- Champion pick -->
      <article
        class="champion-picker-host pitch-panel card relative z-20 rounded-3xl border border-warning/30 bg-linear-to-br from-warning/10 via-base-100/80 to-base-200/70 p-5"
      >
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-primary text-lg">Prediccion de campeon</h2>
          <span class="badge badge-warning"
            >+{{ championBonusPoints }} pts</span
          >
        </div>
        <p class="text-base-content/70 mt-1 text-sm">
          Puedes asignarlo hasta que inicie el primer partido de eliminatorias.
          Si aciertas, ganas {{ championBonusPoints }} puntos.
        </p>

        <div class="mt-4 flex flex-wrap gap-3">
          <div class="relative z-30 min-w-55 flex-1">
            <input
              v-model="championInput"
              class="input input-bordered w-full"
              :disabled="championSelectionLocked"
              placeholder="Busca y selecciona campeon"
              @focus="!championSelectionLocked && (championPickerOpen = true)"
              @input="!championSelectionLocked && (championPickerOpen = true)"
              @blur="onChampionInputBlur"
            />

            <div
              v-if="championPickerOpen"
              class="bg-base-100/98 absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-xl border border-base-300 shadow-2xl"
            >
              <button
                v-for="team in championOptions"
                :key="team.team_key"
                type="button"
                class="hover:bg-primary/10 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                @mousedown.prevent="selectChampionFromList(team)"
              >
                <img
                  v-if="team.logo_url"
                  :src="team.logo_url"
                  :alt="`Escudo de ${team.name}`"
                  class="h-5 w-5 rounded-full border border-base-300 object-cover"
                  loading="lazy"
                />
                <span
                  v-else-if="teamOptionFlagIconClass(team)"
                  :class="teamOptionFlagIconClass(team) || undefined"
                  class="inline-block h-4 w-5 rounded-[999px]"
                  aria-hidden="true"
                />
                <span v-else>{{ teamOptionFlag(team) }}</span>
                <span>{{ team.name }}</span>
              </button>

              <p
                v-if="championOptions.length === 0"
                class="text-base-content/70 px-3 py-3 text-xs"
              >
                Sin coincidencias en equipos registrados.
              </p>
            </div>

            <p
              v-if="selectedChampionInfo"
              class="text-base-content/70 mt-2 inline-flex items-center gap-2 text-xs"
            >
              <img
                v-if="selectedChampionInfo.logoUrl"
                :src="selectedChampionInfo.logoUrl"
                :alt="`Escudo de ${selectedChampionInfo.name}`"
                class="h-4 w-4 rounded-full border border-base-300 object-cover"
                loading="lazy"
              />
              <span
                v-else-if="teamFlagIconClass(selectedChampionInfo.name)"
                :class="teamFlagIconClass(selectedChampionInfo.name) || undefined"
                class="inline-block h-3.5 w-5 rounded-[999px]"
                aria-hidden="true"
              />
              <span v-else>{{
                teamFlagEmojiFromCode(selectedChampionInfo.code)
              }}</span>
              <span>Seleccionado: {{ selectedChampionInfo.name }}</span>
            </p>

            <p
              v-if="championSelectionLocked"
              class="alert alert-warning mt-2 rounded-lg px-3 py-2 text-xs"
            >
              {{ championLockText }}
            </p>
          </div>

          <button
            :disabled="savingChampion || championSelectionLocked"
            class="btn btn-primary btn-bet-glow"
            @click="saveChampion"
          >
            {{ savingChampion ? "Guardando..." : "Guardar campeon" }}
          </button>
        </div>

        <WowSaveBurst
          :visible="championSaved"
          class="mt-3"
          title="Campeon bloqueado"
          subtitle="Bonus potencial al acertar"
        />
      </article>

      <!-- Custom picks -->
      <article
        v-if="!customPicksSupported"
        class="alert alert-warning rounded-2xl text-sm"
      >
        Los picks personalizados no estan disponibles aun. Aplica la migracion
        0033 para habilitarlos.
      </article>

      <article v-else-if="loading" class="alert rounded-2xl text-sm">
        Cargando picks adicionales...
      </article>

      <article
        v-else-if="customPicks.length === 0"
        class="alert rounded-2xl text-sm"
      >
        Esta quiniela todavia no tiene picks adicionales configurados.
      </article>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <article
          v-for="card in customPickCards"
          :key="card.pick.id"
          :class="[
            'card rounded-3xl border p-5 shadow-sm transition',
            pickCardClass(card.pick),
          ]"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-primary text-xs uppercase tracking-[0.14em]">
                Pick {{ card.pick.sort_order }}
              </p>
              <h3 class="text-base-content mt-1 text-lg font-semibold">
                {{ card.pick.title }}
              </h3>
              <p
                v-if="card.pick.description"
                class="text-base-content/70 mt-1 text-sm"
              >
                {{ card.pick.description }}
              </p>
            </div>
            <span class="badge" :class="pickStatusLabel(card.pick).tone">
              {{ pickStatusLabel(card.pick).label }}
            </span>
          </div>

          <div class="mt-2 flex flex-wrap gap-2 text-xs">
            <span class="badge badge-outline">+{{ card.pick.points }} pts</span>
            <span v-if="card.pick.locks_at" class="badge badge-outline">
              Cierra {{ kickoffText(card.pick.locks_at) }}
            </span>
            <span class="badge badge-outline">
              {{ card.pick.requires_text && card.pick.requires_country ? 'Texto + pais' : card.pick.requires_country ? 'Pais' : 'Texto' }}
            </span>
          </div>

          <div class="mt-4 space-y-3">
            <div v-if="card.pick.requires_text">
              <label class="text-base-content/70 text-xs uppercase">
                Respuesta
              </label>
              <input
                v-model="card.draft.text"
                class="input input-bordered mt-1 w-full"
                :disabled="pickLocked(card.pick)"
                placeholder="Escribe tu respuesta"
              />
            </div>

            <div v-if="card.pick.requires_country">
              <label class="text-base-content/70 text-xs uppercase">
                Pais
              </label>
              <div class="mt-1 flex items-center gap-2">
                <span
                  v-if="teamFlagIconClass(card.draft.country)"
                  :class="teamFlagIconClass(card.draft.country) || undefined"
                  class="inline-block h-4 w-5 rounded-[999px]"
                  aria-hidden="true"
                />
                <select
                  v-model="card.draft.country"
                  class="select select-bordered w-full"
                  :disabled="pickLocked(card.pick)"
                >
                  <option value="">Selecciona un pais</option>
                  <option
                    v-for="team in registeredTeams"
                    :key="team.team_key"
                    :value="team.name"
                  >
                    {{ team.name }}
                  </option>
                </select>
              </div>
            </div>

            <p
              v-if="card.draft.error"
              class="text-error text-xs"
            >
              {{ card.draft.error }}
            </p>
            <p
              v-else-if="card.draft.message"
              class="text-success text-xs"
            >
              {{ card.draft.message }}
            </p>

            <button
              class="btn btn-primary btn-sm w-full"
              :disabled="pickLocked(card.pick) || card.draft.saving"
              @click="saveCustomPick(card.pick)"
            >
              {{ card.draft.saving ? "Guardando..." : "Guardar pick" }}
            </button>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
