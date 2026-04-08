<script setup lang="ts">
defineProps<{
  quiniela: {
    name: string;
    access_code: string;
    start_date: string;
  } | null;
  isGlobalAdmin: boolean;
  globalStats: {
    totals?: {
      quinielas?: number;
      users?: number;
      members?: number;
      predictions?: number;
    };
  } | null;
  managedQuinielasCount: number;
  teamsTotal: number;
  syncStatus: {
    requestsUsedToday: number;
    dailyBudget: number;
  } | null;
}>();

const emit = defineEmits<{
  navigate: [section: "quinielas" | "teams" | "ingestion"];
}>();
</script>

<template>
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">Resumen del panel</h2>
    <p class="text-base-content/70 mt-2 text-sm">
      {{
        isGlobalAdmin
          ? "Vista global: administra quinielas, catalogo de selecciones y sincronizacion API."
          : "Vista local: administra tu propia quiniela y realiza ajustes a jugadores."
      }}
    </p>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
        <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
          Quiniela activa
        </p>
        <p class="text-base-content mt-1 text-sm font-semibold">
          {{ quiniela?.name || "Sin quiniela activa" }}
        </p>
      </div>

      <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
        <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
          {{ isGlobalAdmin ? "Quinielas totales" : "Quinielas administradas" }}
        </p>
        <p class="text-base-content mt-1 text-sm font-semibold">
          {{
            isGlobalAdmin
              ? (globalStats?.totals?.quinielas ?? "--")
              : managedQuinielasCount
          }}
        </p>
      </div>

      <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
        <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
          {{ isGlobalAdmin ? "Equipos en catalogo" : "Alcance de gestion" }}
        </p>
        <p class="text-base-content mt-1 text-sm font-semibold">
          {{ isGlobalAdmin ? teamsTotal : "Solo tu quiniela" }}
        </p>
      </div>

      <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
        <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
          {{ isGlobalAdmin ? "Cuota API hoy" : "Operacion permitida" }}
        </p>
        <p class="text-base-content mt-1 text-sm font-semibold">
          {{
            isGlobalAdmin
              ? `${syncStatus?.requestsUsedToday ?? 0}/${syncStatus?.dailyBudget ?? 0}`
              : "Configuracion y ajustes"
          }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        class="btn btn-outline btn-sm"
        @click="emit('navigate', 'quinielas')"
      >
        Ir a tu gestion
      </button>
      <button
        v-if="isGlobalAdmin"
        class="btn btn-outline btn-sm"
        @click="emit('navigate', 'teams')"
      >
        Ir a Equipos
      </button>
      <button
        v-if="isGlobalAdmin"
        class="btn btn-outline btn-sm"
        @click="emit('navigate', 'ingestion')"
      >
        Ir a Ingesta API
      </button>
    </div>

    <div
      v-if="quiniela"
      class="card mt-4 rounded-xl border border-base-300 bg-base-100/70 p-4"
    >
      <p class="text-base-content text-sm">
        Access code:
        <span class="font-semibold">{{ quiniela.access_code }}</span>
      </p>
      <p class="text-base-content/70 mt-1 text-sm">
        Inicio: {{ new Date(quiniela.start_date).toLocaleString("es-MX") }}
      </p>
    </div>
  </article>
</template>
