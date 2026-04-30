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
    title: "Mi quiniela",
    to: "/dashboard/mi-quiniela",
    text: "Mira tus respuestas, estado de aciertos y puntos en un solo lugar.",
  },
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
  {
    title: "Estadisticas",
    to: "/dashboard/estadisticas",
    text: "Explora graficas de rendimiento, aciertos y evolucion de puntos.",
  },
];
</script>

<template>
  <section class="space-y-6">
    <article
      class="pitch-panel card neon-border rounded-3xl border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <p class="text-primary text-xs uppercase tracking-[0.18em]">Dashboard</p>
      <h1 class="text-base-content mt-2 text-3xl sm:text-4xl">
        Bienvenido, {{ username }}
      </h1>

      <div
        class="card mt-5 rounded-2xl border border-base-300 bg-base-100/70 p-4 text-sm text-base-content"
        v-if="quiniela"
      >
        <div class="flex items-start gap-3">
          <img
            v-if="quiniela.logo_url"
            :src="quiniela.logo_url"
            :alt="`Logo de ${quiniela.name}`"
            class="h-14 w-14 rounded-xl border border-base-300 bg-base-200 object-contain p-1"
          />
          <div class="min-w-0">
            <p class="text-base-content/70 text-xs uppercase tracking-[0.14em]">
              Quiniela activa
            </p>
            <p class="text-primary mt-1 text-lg font-semibold">
              {{ quiniela.name }}
            </p>
          </div>
        </div>
        <p class="text-base-content/70 mt-1">
          {{ quiniela.description || "Sin descripcion." }}
        </p>
      </div>

      <div class="alert alert-warning mt-5 rounded-2xl p-4 text-sm" v-else>
        <p>Aun no tienes una quiniela activa en esta sesion.</p>
        <NuxtLink
          to="/ingresar"
          class="link link-hover mt-2 inline-flex font-semibold"
        >
          Unirme con codigo
        </NuxtLink>
      </div>
    </article>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="item in quickLinks"
        :key="item.to"
        :to="item.to"
        class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/50"
      >
        <h2 class="text-primary text-xl">{{ item.title }}</h2>
        <p class="text-base-content/70 mt-2 text-sm">{{ item.text }}</p>
      </NuxtLink>
    </div>

    <article
      class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
    >
      <h2 class="text-base-content text-xl">Siguiente paso</h2>
      <p class="text-base-content/70 mt-2 text-sm">
        Define tu campeon en la pantalla de posiciones antes de
        {{ quiniela?.start_date || "la fecha de inicio" }} para habilitar el
        bonus de 10 puntos.
      </p>
    </article>

    <article
      v-if="myQuinielas.length"
      class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-primary text-xl">Mis quinielas</h2>
        <NuxtLink
          to="/ingresar"
          class="link link-hover text-warning text-xs font-semibold uppercase tracking-[0.12em]"
        >
          Unirme a otra
        </NuxtLink>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-2">
        <button
          v-for="membership in myQuinielas"
          :key="membership.quiniela_id"
          class="card w-full border p-4 text-left transition"
          :class="[
            activeQuinielaId === membership.quiniela_id
              ? 'border-primary bg-primary/10'
              : 'border-base-300 bg-base-100/70 hover:border-primary/40',
          ]"
          @click="selectQuiniela(membership.quiniela_id)"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="membership.quiniela?.logo_url"
              :src="membership.quiniela.logo_url"
              :alt="`Logo de ${membership.quiniela.name}`"
              class="h-10 w-10 rounded-lg border border-base-300 bg-base-200 object-contain p-1"
            />
            <div class="min-w-0">
              <p class="text-base-content text-sm font-semibold">
                {{ membership.quiniela?.name || "Quiniela" }}
              </p>
              <p class="text-base-content/70 mt-1 text-xs">
                {{ membership.quiniela?.description || "Sin descripcion." }}
              </p>
            </div>
          </div>
          <p class="text-warning mt-2 text-xs">
            Puntos actuales: {{ membership.total_points }}
          </p>
        </button>
      </div>
    </article>
  </section>
</template>
