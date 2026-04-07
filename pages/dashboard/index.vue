<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const user = useSupabaseUser();
const {
  quiniela,
  loadActiveQuiniela,
  loadMyQuinielas,
  myQuinielas,
  activeQuinielaId,
  setActiveQuiniela,
} = useActiveQuiniela();

const username = computed(() => {
  const metadataName = user.value?.user_metadata?.username;

  if (typeof metadataName === "string" && metadataName.length > 0) {
    return metadataName;
  }

  const email = user.value?.email;
  return email ? email.split("@")[0] : "Jugador";
});

onMounted(() => {
  void loadActiveQuiniela();
  void loadMyQuinielas();
});

const selectQuiniela = async (quinielaId: string) => {
  setActiveQuiniela(quinielaId);
  await loadActiveQuiniela();
};

const quickLinks = [
  {
    title: "Fase de grupos",
    to: "/dashboard/grupos",
    text: "Carga y ajusta predicciones por cada grupo del torneo.",
  },
  {
    title: "Eliminatorias",
    to: "/dashboard/eliminatorias",
    text: "Sigue las llaves desde round 32 hasta la gran final.",
  },
  {
    title: "Posiciones",
    to: "/dashboard/posiciones",
    text: "Revisa el ranking actualizado de tu quiniela.",
  },
];
</script>

<template>
  <section class="space-y-6">
    <article class="pitch-panel neon-border rounded-3xl p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
        Dashboard
      </p>
      <h1 class="mt-2 text-3xl text-white sm:text-4xl">
        Bienvenido, {{ username }}
      </h1>

      <div
        class="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-200"
        v-if="quiniela"
      >
        <p class="text-xs uppercase tracking-[0.14em] text-(--text-muted)">
          Quiniela activa
        </p>
        <p class="mt-1 text-lg font-semibold text-emerald-200">
          {{ quiniela.name }}
        </p>
        <p class="mt-1 text-(--text-muted)">
          {{ quiniela.description || "Sin descripcion." }}
        </p>
      </div>

      <div
        class="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/5 p-4 text-sm text-amber-100"
        v-else
      >
        <p>Aun no tienes una quiniela activa en esta sesion.</p>
        <NuxtLink
          to="/ingresar"
          class="mt-2 inline-flex font-semibold text-amber-200 underline underline-offset-4"
        >
          Unirme con codigo
        </NuxtLink>
      </div>
    </article>

    <div class="grid gap-4 md:grid-cols-3">
      <NuxtLink
        v-for="item in quickLinks"
        :key="item.to"
        :to="item.to"
        class="pitch-panel rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-emerald-400/25"
      >
        <h2 class="text-xl text-emerald-200">{{ item.title }}</h2>
        <p class="mt-2 text-sm text-(--text-muted)">{{ item.text }}</p>
      </NuxtLink>
    </div>

    <article class="pitch-panel rounded-2xl p-5">
      <h2 class="text-xl text-white">Siguiente paso</h2>
      <p class="mt-2 text-sm text-(--text-muted)">
        Define tu campeon en la pantalla de posiciones antes de
        {{ quiniela?.start_date || "la fecha de inicio" }} para habilitar el
        bonus de 10 puntos.
      </p>
    </article>

    <article
      v-if="myQuinielas.length"
      class="pitch-panel rounded-2xl border border-white/10 p-5"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl text-emerald-200">Mis quinielas</h2>
        <NuxtLink
          to="/ingresar"
          class="text-xs font-semibold uppercase tracking-[0.12em] text-amber-200 underline underline-offset-4"
        >
          Unirme a otra
        </NuxtLink>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <button
          v-for="membership in myQuinielas"
          :key="membership.quiniela_id"
          class="w-full rounded-xl border p-4 text-left transition"
          :class="[
            activeQuinielaId === membership.quiniela_id
              ? 'border-emerald-300/45 bg-emerald-500/10'
              : 'border-white/10 bg-black/25 hover:border-emerald-300/25',
          ]"
          @click="selectQuiniela(membership.quiniela_id)"
        >
          <p class="text-sm font-semibold text-white">
            {{ membership.quiniela?.name || "Quiniela" }}
          </p>
          <p class="mt-1 text-xs text-(--text-muted)">
            {{ membership.quiniela?.description || "Sin descripcion." }}
          </p>
          <p class="mt-2 text-xs text-amber-200">
            Puntos actuales: {{ membership.total_points }}
          </p>
        </button>
      </div>
    </article>
  </section>
</template>
