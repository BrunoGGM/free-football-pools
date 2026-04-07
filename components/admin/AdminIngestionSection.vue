<script setup lang="ts">
defineProps<{
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
    home_team: string;
    away_team: string;
    status: string;
    updated_at: string;
  }>;
}>();

const emit = defineEmits<{
  runFixturesSync: [];
  runTeamsSync: [];
  "update:forceSync": [value: boolean];
}>();
</script>

<template>
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">Monitoreo de ingesta de API</h2>
    <p class="text-base-content/70 mt-2 text-sm">
      Este bloque muestra los ultimos partidos actualizados en la tabla matches
      para verificar el pulso de ingesta.
    </p>

    <div
      class="card mt-4 space-y-3 rounded-xl border border-base-300 bg-base-100/70 p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-base-content text-sm">
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
        </div>

        <div class="flex items-center gap-3">
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

      <p v-if="syncStatus?.state?.lastError" class="alert alert-error text-xs">
        Ultimo error: {{ syncStatus.state.lastError }}
      </p>

      <p v-if="syncMessage" class="alert alert-success text-xs">
        {{ syncMessage }}
      </p>

      <p v-if="teamsSyncMessage" class="alert alert-info text-xs">
        {{ teamsSyncMessage }}
      </p>

      <p v-if="syncError" class="alert alert-error text-xs">
        {{ syncError }}
      </p>

      <p v-if="teamsSyncError" class="alert alert-error text-xs">
        {{ teamsSyncError }}
      </p>
    </div>

    <p v-if="loadingLogs" class="text-base-content/70 mt-4 text-sm">
      Cargando log...
    </p>
    <p v-else-if="logsError" class="alert alert-error mt-4 text-sm">
      {{ logsError }}
    </p>

    <div v-else class="mt-4 overflow-hidden rounded-xl border border-base-300">
      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
        >
          <tr>
            <th class="px-4 py-3">Partido</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Actualizado</th>
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
            <td class="px-4 py-3">
              <span
                class="badge badge-sm text-xs font-semibold"
                :class="[
                  entry.status === 'finished' && 'badge-neutral',
                  entry.status === 'in_progress' && 'badge-success',
                  entry.status === 'pending' && 'badge-warning',
                ]"
              >
                {{ entry.status }}
              </span>
            </td>
            <td class="text-base-content/70 px-4 py-3">
              {{ entry.updated_at }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
