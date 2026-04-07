<script setup lang="ts">
defineProps<{
  quiniela: {
    name: string;
    access_code: string;
    start_date: string;
  } | null;
  globalStats: {
    totals?: {
      quinielas?: number;
    };
  } | null;
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
  <article class="pitch-panel rounded-2xl p-5">
    <h2 class="text-xl text-white">Resumen del panel</h2>
    <p class="mt-2 text-sm text-(--text-muted)">
      Navega por secciones para administrar quinielas, equipos e ingesta sin
      tener una pagina extensa.
    </p>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-xl border border-white/10 bg-black/35 p-4">
        <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          Quiniela activa
        </p>
        <p class="mt-1 text-sm font-semibold text-white">
          {{ quiniela?.name || "Sin quiniela activa" }}
        </p>
      </div>

      <div class="rounded-xl border border-white/10 bg-black/35 p-4">
        <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          Quinielas totales
        </p>
        <p class="mt-1 text-sm font-semibold text-white">
          {{ globalStats?.totals?.quinielas ?? "--" }}
        </p>
      </div>

      <div class="rounded-xl border border-white/10 bg-black/35 p-4">
        <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          Equipos en catalogo
        </p>
        <p class="mt-1 text-sm font-semibold text-white">{{ teamsTotal }}</p>
      </div>

      <div class="rounded-xl border border-white/10 bg-black/35 p-4">
        <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          Cuota API hoy
        </p>
        <p class="mt-1 text-sm font-semibold text-white">
          {{ syncStatus?.requestsUsedToday ?? 0 }}/{{
            syncStatus?.dailyBudget ?? 0
          }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <button
        class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="emit('navigate', 'quinielas')"
      >
        Ir a Quinielas
      </button>
      <button
        class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="emit('navigate', 'teams')"
      >
        Ir a Equipos
      </button>
      <button
        class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="emit('navigate', 'ingestion')"
      >
        Ir a Ingesta API
      </button>
    </div>

    <div
      v-if="quiniela"
      class="mt-4 rounded-xl border border-white/10 bg-black/25 p-4"
    >
      <p class="text-sm text-slate-100">
        Access code:
        <span class="font-semibold">{{ quiniela.access_code }}</span>
      </p>
      <p class="mt-1 text-sm text-(--text-muted)">
        Inicio: {{ new Date(quiniela.start_date).toLocaleString("es-MX") }}
      </p>
    </div>
  </article>
</template>
