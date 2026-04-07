<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

interface PositionRow {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  predicted_champion: string | null;
}

const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const activeQuinielaId = useCookie<string | null>("active_quiniela_id");

const rows = ref<PositionRow[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const championInput = ref("");
const savingChampion = ref(false);

const loadRanking = async () => {
  if (!activeQuinielaId.value) {
    rows.value = [];
    return;
  }

  loading.value = true;
  errorMessage.value = null;

  const { data: members, error: membersError } = await client
    .from("quiniela_members")
    .select("user_id, total_points, predicted_champion")
    .eq("quiniela_id", activeQuinielaId.value)
    .order("total_points", { ascending: false });

  if (membersError) {
    loading.value = false;
    errorMessage.value = membersError.message;
    return;
  }

  const userIds = [
    ...new Set((members ?? []).map((item) => item.user_id as string)),
  ];
  const profilesMap = new Map<
    string,
    { username: string; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await client
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      loading.value = false;
      errorMessage.value = profilesError.message;
      return;
    }

    for (const profile of profiles ?? []) {
      profilesMap.set(profile.id as string, {
        username: (profile.username as string) ?? "Jugador",
        avatar_url: (profile.avatar_url as string | null) ?? null,
      });
    }
  }

  const normalized = (members ?? []).map((member, index) => {
    const profile = profilesMap.get(member.user_id as string);

    return {
      rank: index + 1,
      user_id: member.user_id as string,
      username: profile?.username ?? "Jugador",
      avatar_url: profile?.avatar_url ?? null,
      total_points: Number(member.total_points ?? 0),
      predicted_champion: (member.predicted_champion as string | null) ?? null,
    };
  });

  rows.value = normalized;

  const ownRow = normalized.find((entry) => entry.user_id === user.value?.id);
  championInput.value = ownRow?.predicted_champion ?? "";
  loading.value = false;
};

const saveChampion = async () => {
  if (!activeQuinielaId.value || !user.value) {
    return;
  }

  savingChampion.value = true;
  errorMessage.value = null;

  const champion = championInput.value.trim();

  const { error } = await client
    .from("quiniela_members")
    .update({ predicted_champion: champion.length > 0 ? champion : null })
    .eq("user_id", user.value.id)
    .eq("quiniela_id", activeQuinielaId.value);

  savingChampion.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  await loadRanking();
};

onMounted(() => {
  void loadRanking();
});
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-primary text-xs uppercase tracking-[0.18em]">
          Dashboard
        </p>
        <h1 class="text-base-content mt-1 text-3xl">Tabla de posiciones</h1>
      </div>
      <button class="btn btn-outline btn-sm" @click="loadRanking">
        Refrescar
      </button>
    </header>

    <article v-if="!activeQuinielaId" class="alert alert-warning rounded-2xl">
      Activa una quiniela para ver posiciones.
      <NuxtLink to="/ingresar" class="link link-hover ml-2 font-semibold"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article
      v-else
      class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
    >
      <h2 class="text-primary text-lg">Prediccion de campeon</h2>
      <p class="text-base-content/70 mt-1 text-sm">
        Si aciertas antes del inicio del torneo, sumas 10 puntos bonus.
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <input
          v-model="championInput"
          class="input input-bordered min-w-55 flex-1"
          placeholder="Escribe el campeon"
        />
        <button
          :disabled="savingChampion"
          class="btn btn-primary"
          @click="saveChampion"
        >
          {{ savingChampion ? "Guardando..." : "Guardar campeon" }}
        </button>
      </div>
    </article>

    <article v-if="loading" class="alert rounded-2xl text-sm">
      Cargando ranking...
    </article>
    <article
      v-else-if="errorMessage"
      class="alert alert-error rounded-2xl text-sm"
    >
      {{ errorMessage }}
    </article>
    <article
      v-else
      class="overflow-hidden rounded-2xl border border-base-300 bg-base-100/70"
    >
      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
        >
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Jugador</th>
            <th class="px-4 py-3">Puntos</th>
            <th class="px-4 py-3">Campeon</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.user_id"
            class="border-t border-base-300"
          >
            <td class="text-primary px-4 py-3 font-semibold">
              {{ row.rank }}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img
                  v-if="row.avatar_url"
                  :src="row.avatar_url"
                  alt="avatar"
                  class="h-7 w-7 rounded-full border border-base-300 object-cover"
                />
                <div
                  v-else
                  class="bg-primary/20 text-primary grid h-7 w-7 place-content-center rounded-full text-xs font-bold"
                >
                  {{ row.username.slice(0, 1).toUpperCase() }}
                </div>
                <span>{{ row.username }}</span>
              </div>
            </td>
            <td class="px-4 py-3 font-semibold">{{ row.total_points }}</td>
            <td class="text-base-content/70 px-4 py-3">
              {{ row.predicted_champion || "-" }}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>
