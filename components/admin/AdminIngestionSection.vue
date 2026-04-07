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
  <article class="pitch-panel rounded-2xl p-5">
    <h2 class="text-xl text-white">Monitoreo de ingesta de API</h2>
    <p class="mt-2 text-sm text-(--text-muted)">
      Este bloque muestra los ultimos partidos actualizados en la tabla matches
      para verificar el pulso de ingesta.
    </p>

    <div
      class="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 space-y-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm text-slate-200">
          <p>
            Cuota API-FOOTBALL hoy:
            <span class="font-semibold text-emerald-200">
              {{ syncStatus?.requestsUsedToday ?? 0 }}/{{
                syncStatus?.dailyBudget ?? 0
              }}
            </span>
            <span class="ml-2 text-(--text-muted)">
              (restantes: {{ syncStatus?.remainingToday ?? 0 }})
            </span>
          </p>
          <p class="mt-1 text-(--text-muted)">
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
            class="inline-flex items-center gap-2 text-xs text-(--text-muted)"
          >
            <input
              :checked="forceSync"
              type="checkbox"
              class="h-4 w-4 rounded border-white/20 bg-black/50"
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
            class="rounded-full border border-emerald-300/45 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="syncingFixtures"
            @click="emit('runFixturesSync')"
          >
            {{ syncingFixtures ? "Sincronizando..." : "Sincronizar fixtures" }}
          </button>

          <button
            class="rounded-full border border-sky-300/45 px-4 py-2 text-sm text-sky-100 transition hover:border-sky-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
        v-if="syncStatus?.state?.lastError"
        class="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        Ultimo error: {{ syncStatus.state.lastError }}
      </p>

      <p
        v-if="syncMessage"
        class="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
      >
        {{ syncMessage }}
      </p>

      <p
        v-if="teamsSyncMessage"
        class="rounded-lg border border-sky-300/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"
      >
        {{ teamsSyncMessage }}
      </p>

      <p
        v-if="syncError"
        class="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        {{ syncError }}
      </p>

      <p
        v-if="teamsSyncError"
        class="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        {{ teamsSyncError }}
      </p>
    </div>

    <p v-if="loadingLogs" class="mt-4 text-sm text-(--text-muted)">
      Cargando log...
    </p>
    <p
      v-else-if="logsError"
      class="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {{ logsError }}
    </p>

    <div v-else class="mt-4 overflow-hidden rounded-xl border border-white/8">
      <table class="min-w-full text-sm">
        <thead
          class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
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
            class="border-t border-white/8"
          >
            <td class="px-4 py-3">
              {{ entry.home_team }} vs {{ entry.away_team }}
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-1 text-xs font-semibold"
                :class="[
                  entry.status === 'finished' &&
                    'bg-slate-200/15 text-slate-100',
                  entry.status === 'in_progress' &&
                    'bg-emerald-400/25 text-emerald-100',
                  entry.status === 'pending' &&
                    'bg-amber-400/20 text-amber-100',
                ]"
              >
                {{ entry.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-(--text-muted)">
              {{ entry.updated_at }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
