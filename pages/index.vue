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
  <section class="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
    <div class="pitch-panel neon-border overflow-hidden rounded-3xl p-6 sm:p-8">
      <p
        class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200"
      >
        Mundial 2026
      </p>
      <h1 class="mt-3 text-4xl leading-tight text-white sm:text-5xl">
        Vive la quiniela
        <span class="text-emerald-300">mas intensa</span>
        de tu grupo
      </h1>
      <p class="mt-5 max-w-xl text-base text-(--text-muted) sm:text-lg">
        Crea o unete a tu sala privada, pronostica cada partido y compite en un
        ranking que se mueve con cada marcador en vivo.
      </p>

      <div class="mt-7 flex flex-wrap gap-3">
        <NuxtLink
          :to="ctaPrimary"
          class="rounded-full bg-emerald-400/25 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/35"
        >
          {{ user ? "Ir al dashboard" : "Iniciar sesion" }}
        </NuxtLink>
        <NuxtLink
          :to="ctaSecondary"
          class="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-300/45 hover:text-amber-100"
        >
          {{ user ? "Ingresar con codigo" : "Registrarse" }}
        </NuxtLink>
      </div>

      <div class="mt-10 grid gap-3 sm:grid-cols-3">
        <article
          v-for="item in highlights"
          :key="item.title"
          class="rounded-xl border border-white/8 bg-black/20 p-4"
        >
          <h2 class="text-lg text-emerald-200">{{ item.title }}</h2>
          <p class="mt-2 text-sm text-(--text-muted)">{{ item.text }}</p>
        </article>
      </div>
    </div>

    <aside class="pitch-panel overflow-hidden rounded-3xl p-6 sm:p-7">
      <p
        class="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200"
      >
        Puntos oficiales
      </p>
      <h2 class="mt-2 text-2xl text-white">Reglamento rapido</h2>

      <ul class="mt-5 space-y-3 text-sm text-slate-200">
        <li class="rounded-xl border border-white/8 bg-black/20 p-3">
          <p class="font-semibold text-emerald-200">1 punto</p>
          <p class="text-(--text-muted)">
            Acertar resultado (local, empate o visita).
          </p>
        </li>
        <li class="rounded-xl border border-white/8 bg-black/20 p-3">
          <p class="font-semibold text-emerald-200">3 puntos</p>
          <p class="text-(--text-muted)">
            Acertar marcador exacto del partido.
          </p>
        </li>
        <li class="rounded-xl border border-white/8 bg-black/20 p-3">
          <p class="font-semibold text-amber-200">20 puntos bonus</p>
          <p class="text-(--text-muted)">
            Acertar campeon predicho antes del inicio del torneo.
          </p>
        </li>
      </ul>

      <NuxtLink
        to="/ingresar"
        class="mt-6 inline-flex rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
      >
        Ya tienes codigo de sala
      </NuxtLink>
    </aside>
  </section>
</template>
