<script setup lang="ts">
defineProps<{
  canRunSync: boolean;
  syncStatus: {
    requestsUsedToday: number;
    dailyBudget: number;
    remainingToday: number;
    state?: {
      lastSyncedAt: string | null;
      lastError: string | null;
    };
  } | null;
  forceSync: boolean;
  syncingFixtures: boolean;
  syncingTeams: boolean;
  syncMessage: string | null;
  teamsSyncMessage: string | null;
  syncError: string | null;
  teamsSyncError: string | null;
  loadingLogs: boolean;
  logsError: string | null;
  latestMatches: Array<{
    id: string;
    stage: string;
    match_time: string;
    match_time_iso: string;
    home_team: string;
    away_team: string;
    home_score: number | null;
    away_score: number | null;
    home_penalty_score: number | null;
    away_penalty_score: number | null;
    status: string;
    updated_at: string;
  }>;
  matchSearch: string;
  matchStage: string;
  matchStageOptions: Array<{
    value: string;
    label: string;
  }>;
  currentPage: number;
  totalPages: number;
  totalMatches: number;
  showingStart: number;
  showingEnd: number;
  matchScoreDraftById: Record<
    string,
    {
      home_score: string;
      away_score: string;
      home_penalty_score: string;
      away_penalty_score: string;
      status: "pending" | "in_progress" | "finished";
    }
  >;
  savingMatchScoreId: string | null;
  matchScoreMessage: string | null;
  matchScoreError: string | null;
}>();

const emit = defineEmits<{
  runFixturesSync: [];
  runTeamsSync: [];
  "update:match-search": [value: string];
  "update:match-stage": [value: string];
  goToPage: [page: number];
  updateMatchScoreDraft: [
    payload: {
      id: string;
      field:
        | "home_score"
        | "away_score"
        | "home_penalty_score"
        | "away_penalty_score"
        | "status";
      value: string;
    },
  ];
  saveMatchScore: [id: string];
  "update:forceSync": [value: boolean];
}>();
</script>

<template>
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">Monitoreo de ingesta de API</h2>
    <p class="text-base-content/70 mt-2 text-sm">
      Este bloque muestra partidos recientes y permite ajustar marcador/estado
      manualmente.
    </p>

    <div
      class="card mt-4 space-y-3 rounded-xl border border-base-300 bg-base-100/70 p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-base-content text-sm">
          <template v-if="canRunSync">
            <p>
              Cuota API-FOOTBALL hoy:
              <span class="text-primary font-semibold">
                {{ syncStatus?.requestsUsedToday ?? 0 }}/{{
                  syncStatus?.dailyBudget ?? 0
                }}
              </span>
              <span class="text-base-content/70 ml-2">
                (restantes: {{ syncStatus?.remainingToday ?? 0 }})
              </span>
            </p>
            <p class="text-base-content/70 mt-1">
              Ultimo sync:
              {{
                syncStatus?.state?.lastSyncedAt
                  ? new Date(syncStatus.state.lastSyncedAt).toLocaleString(
                      "es-MX",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                      },
                    )
                  : "sin ejecuciones"
              }}
            </p>
          </template>

          <p v-else class="text-base-content/70">
            Edicion manual activa para administradores de quiniela.
          </p>
        </div>

        <div v-if="canRunSync" class="flex items-center gap-3">
          <label
            class="label cursor-pointer text-base-content/70 inline-flex items-center gap-2 text-xs"
          >
            <input
              :checked="forceSync"
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm"
              @change="
                emit(
                  'update:forceSync',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            Forzar sync
          </label>

          <button
            class="btn btn-primary btn-sm"
            :disabled="syncingFixtures"
            @click="emit('runFixturesSync')"
          >
            {{ syncingFixtures ? "Sincronizando..." : "Sincronizar fixtures" }}
          </button>

          <button
            class="btn btn-info btn-sm"
            :disabled="syncingTeams"
            @click="emit('runTeamsSync')"
          >
            {{
              syncingTeams
                ? "Sincronizando..."
                : "Sincronizar selecciones y logos"
            }}
          </button>
        </div>
      </div>

      <p
        v-if="canRunSync && syncStatus?.state?.lastError"
        class="alert alert-error text-xs"
      >
        Ultimo error: {{ syncStatus.state.lastError }}
      </p>

      <p v-if="canRunSync && syncMessage" class="alert alert-success text-xs">
        {{ syncMessage }}
      </p>

      <p v-if="canRunSync && teamsSyncMessage" class="alert alert-info text-xs">
        {{ teamsSyncMessage }}
      </p>

      <p v-if="matchScoreMessage" class="alert alert-success text-xs">
        {{ matchScoreMessage }}
      </p>

      <p v-if="canRunSync && syncError" class="alert alert-error text-xs">
        {{ syncError }}
      </p>

      <p v-if="canRunSync && teamsSyncError" class="alert alert-error text-xs">
        {{ teamsSyncError }}
      </p>

      <p v-if="matchScoreError" class="alert alert-error text-xs">
        {{ matchScoreError }}
      </p>
    </div>

    <p v-if="loadingLogs" class="text-base-content/70 mt-4 text-sm">
      Cargando log...
    </p>
    <p v-else-if="logsError" class="alert alert-error mt-4 text-sm">
      {{ logsError }}
    </p>

    <div v-else class="mt-4 space-y-3">
      <div
        class="card flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100/70 p-3 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex w-full flex-col gap-2 md:max-w-2xl md:flex-row md:items-center">
          <label
            class="input input-bordered input-sm flex w-full items-center gap-2 md:max-w-sm"
          >
            <span class="text-base-content/60 text-xs">Buscar</span>
            <input
              :value="matchSearch"
              type="text"
              class="grow"
              placeholder="Equipo, fase o estado"
              @input="
                emit(
                  'update:match-search',
                  ($event.target as HTMLInputElement).value,
                )
              "
            />
          </label>

          <label
            class="select select-bordered select-sm flex w-full items-center gap-2 md:w-60"
          >
            <span class="text-base-content/60 text-xs">Fase</span>
            <select
              :value="matchStage"
              class="w-full bg-transparent text-sm outline-none"
              @change="
                emit(
                  'update:match-stage',
                  ($event.target as HTMLSelectElement).value,
                )
              "
            >
              <option value="all">Todas</option>
              <option
                v-for="stageOption in matchStageOptions"
                :key="stageOption.value"
                :value="stageOption.value"
              >
                {{ stageOption.label }}
              </option>
            </select>
          </label>
        </div>

        <p class="text-base-content/70 text-xs">
          Mostrando {{ showingStart }}-{{ showingEnd }} de {{ totalMatches }}
        </p>
      </div>

      <div class="overflow-hidden rounded-xl border border-base-300">
        <table class="table min-w-full text-sm">
          <thead
            class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
          >
            <tr>
              <th class="px-4 py-3">Partido</th>
              <th class="px-4 py-3">Fase</th>
              <th class="px-4 py-3">Hora</th>
              <th class="px-4 py-3">Marcador</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Actualizado</th>
              <th class="px-4 py-3">Accion</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in latestMatches"
              :key="entry.id"
              class="border-t border-base-300"
            >
              <td class="px-4 py-3">
                {{ entry.home_team }} vs {{ entry.away_team }}
              </td>
              <td class="text-base-content/70 px-4 py-3 text-xs uppercase">
                {{ entry.stage.replaceAll("_", " ") }}
              </td>
              <td class="text-base-content/70 px-4 py-3 text-xs">
                {{ entry.match_time }}
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-col gap-1">
                  <div
                    class="bg-info/5 border-info/20 rounded-lg border px-2 py-1"
                  >
                    <div class="mb-1 flex items-center gap-2">
                      <span
                        class="text-info bg-info/15 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                      >
                        GOLES
                      </span>
                      <span class="text-base-content/50 text-[10px]"
                        >tiempo regular</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        :value="
                          matchScoreDraftById[entry.id]?.home_score ??
                          (entry.home_score === null
                            ? ''
                            : String(entry.home_score))
                        "
                        type="number"
                        min="0"
                        class="input input-bordered input-xs border-info/30 bg-base-100 w-16"
                        @input="
                          emit('updateMatchScoreDraft', {
                            id: entry.id,
                            field: 'home_score',
                            value: ($event.target as HTMLInputElement).value,
                          })
                        "
                      />
                      <span class="text-info/70 text-xs">-</span>
                      <input
                        :value="
                          matchScoreDraftById[entry.id]?.away_score ??
                          (entry.away_score === null
                            ? ''
                            : String(entry.away_score))
                        "
                        type="number"
                        min="0"
                        class="input input-bordered input-xs border-info/30 bg-base-100 w-16"
                        @input="
                          emit('updateMatchScoreDraft', {
                            id: entry.id,
                            field: 'away_score',
                            value: ($event.target as HTMLInputElement).value,
                          })
                        "
                      />
                    </div>
                  </div>

                  <div
                    v-if="
                      [
                        'round_32',
                        'round_16',
                        'quarter_final',
                        'semi_final',
                        'third_place',
                        'final',
                      ].includes(entry.stage)
                    "
                    class="bg-warning/10 border-warning/30 rounded-lg border border-dashed px-2 py-1"
                  >
                    <div class="mb-1 flex items-center gap-2">
                      <span
                        class="text-warning bg-warning/20 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
                      >
                        PENALES
                      </span>
                      <span class="text-base-content/50 text-[10px]"
                        >desempate KO</span
                      >
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        :value="
                          matchScoreDraftById[entry.id]?.home_penalty_score ??
                          (entry.home_penalty_score === null
                            ? ''
                            : String(entry.home_penalty_score))
                        "
                        type="number"
                        min="0"
                        class="input input-bordered input-xs border-warning/40 bg-base-100 w-16"
                        @input="
                          emit('updateMatchScoreDraft', {
                            id: entry.id,
                            field: 'home_penalty_score',
                            value: ($event.target as HTMLInputElement).value,
                          })
                        "
                      />
                      <span class="text-warning/80 text-xs">-</span>
                      <input
                        :value="
                          matchScoreDraftById[entry.id]?.away_penalty_score ??
                          (entry.away_penalty_score === null
                            ? ''
                            : String(entry.away_penalty_score))
                        "
                        type="number"
                        min="0"
                        class="input input-bordered input-xs border-warning/40 bg-base-100 w-16"
                        @input="
                          emit('updateMatchScoreDraft', {
                            id: entry.id,
                            field: 'away_penalty_score',
                            value: ($event.target as HTMLInputElement).value,
                          })
                        "
                      />
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <select
                  class="select select-bordered select-xs w-36"
                  :value="matchScoreDraftById[entry.id]?.status ?? entry.status"
                  @change="
                    emit('updateMatchScoreDraft', {
                      id: entry.id,
                      field: 'status',
                      value: ($event.target as HTMLSelectElement).value,
                    })
                  "
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="finished">finished</option>
                </select>
              </td>
              <td class="text-base-content/70 px-4 py-3">
                {{ entry.updated_at }}
              </td>
              <td class="px-4 py-3">
                <button
                  class="btn btn-primary btn-xs"
                  :disabled="savingMatchScoreId === entry.id"
                  @click="emit('saveMatchScore', entry.id)"
                >
                  {{
                    savingMatchScoreId === entry.id ? "Guardando..." : "Guardar"
                  }}
                </button>
              </td>
            </tr>

            <tr v-if="latestMatches.length === 0">
              <td class="text-base-content/70 px-4 py-6 text-sm" colspan="7">
                No hay partidos para el filtro actual.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button
          class="btn btn-outline btn-xs"
          :disabled="currentPage <= 1"
          @click="emit('goToPage', currentPage - 1)"
        >
          Anterior
        </button>
        <span class="text-base-content/70 text-xs">
          Pagina {{ currentPage }} de {{ totalPages }}
        </span>
        <button
          class="btn btn-outline btn-xs"
          :disabled="currentPage >= totalPages"
          @click="emit('goToPage', currentPage + 1)"
        >
          Siguiente
        </button>
      </div>
    </div>
  </article>
</template>
