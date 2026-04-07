<script setup lang="ts">
const user = useSupabaseUser();

const ctaPrimary = computed(() =>
  user.value ? "/dashboard" : "/auth?mode=login",
);
const ctaSecondary = computed(() =>
  user.value ? "/ingresar" : "/auth?mode=register",
);

const highlights = [
  {
    title: "Predicciones por fase",
    text: "Carga tus marcadores para grupos y eliminatorias desde un mismo panel.",
  },
  {
    title: "Ranking en tiempo real",
    text: "Cada gol actualizado recalcula puntos y mueve la tabla al instante.",
  },
  {
    title: "Salas privadas",
    text: "Comparte solo con tu grupo usando codigo de acceso por quiniela.",
  },
];
</script>

<template>
  <section class="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
    <div
      class="pitch-panel card neon-border overflow-hidden border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <p class="text-primary text-xs font-semibold uppercase tracking-[0.2em]">
        Mundial 2026
      </p>
      <h1 class="text-base-content mt-3 text-4xl leading-tight sm:text-5xl">
        Vive la quiniela
        <span class="text-primary">mas intensa</span>
        de tu grupo
      </h1>
      <p class="text-base-content/70 mt-5 max-w-xl text-base sm:text-lg">
        Crea o unete a tu sala privada, pronostica cada partido y compite en un
        ranking que se mueve con cada marcador en vivo.
      </p>

      <div class="mt-7 flex flex-wrap gap-3">
        <NuxtLink :to="ctaPrimary" class="btn btn-primary">
          {{ user ? "Ir al dashboard" : "Iniciar sesion" }}
        </NuxtLink>
        <NuxtLink :to="ctaSecondary" class="btn btn-outline">
          {{ user ? "Ingresar con codigo" : "Registrarse" }}
        </NuxtLink>
      </div>

      <div class="mt-10 grid gap-3 sm:grid-cols-3">
        <article
          v-for="item in highlights"
          :key="item.title"
          class="card border border-base-300 bg-base-100/70 p-4"
        >
          <h2 class="text-primary text-lg">{{ item.title }}</h2>
          <p class="text-base-content/70 mt-2 text-sm">{{ item.text }}</p>
        </article>
      </div>
    </div>

    <aside
      class="pitch-panel card overflow-hidden border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-7"
    >
      <p class="text-warning text-xs font-semibold uppercase tracking-[0.2em]">
        Puntos oficiales
      </p>
      <h2 class="text-base-content mt-2 text-2xl">Reglamento rapido</h2>

      <ul class="text-base-content mt-5 space-y-3 text-sm">
        <li class="card border border-base-300 bg-base-100/70 p-3">
          <p class="text-primary font-semibold">1 punto</p>
          <p class="text-base-content/70">
            Acertar resultado (local, empate o visita).
          </p>
        </li>
        <li class="card border border-base-300 bg-base-100/70 p-3">
          <p class="text-primary font-semibold">3 puntos</p>
          <p class="text-base-content/70">
            Acertar marcador exacto del partido.
          </p>
        </li>
        <li class="card border border-base-300 bg-base-100/70 p-3">
          <p class="text-warning font-semibold">10 puntos bonus</p>
          <p class="text-base-content/70">
            Acertar campeon predicho antes del inicio del torneo.
          </p>
        </li>
      </ul>

      <NuxtLink
        to="/ingresar"
        class="btn btn-outline btn-primary btn-sm mt-6 inline-flex"
      >
        Ya tienes codigo de sala
      </NuxtLink>
    </aside>
  </section>
</template>
