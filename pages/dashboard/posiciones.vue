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
        <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
          Dashboard
        </p>
        <h1 class="mt-1 text-3xl text-white">Tabla de posiciones</h1>
      </div>
      <button
        class="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="loadRanking"
      >
        Refrescar
      </button>
    </header>

    <article
      v-if="!activeQuinielaId"
      class="pitch-panel rounded-2xl border border-amber-300/25 p-5 text-amber-100"
    >
      Activa una quiniela para ver posiciones.
      <NuxtLink
        to="/ingresar"
        class="ml-2 font-semibold underline underline-offset-4"
        >Ir a ingresar</NuxtLink
      >
    </article>

    <article v-else class="pitch-panel rounded-2xl p-5">
      <h2 class="text-lg text-emerald-200">Prediccion de campeon</h2>
      <p class="mt-1 text-sm text-(--text-muted)">
        Si aciertas antes del inicio del torneo, sumas 20 puntos bonus.
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <input
          v-model="championInput"
          class="min-w-55 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-slate-100 outline-none transition focus:border-emerald-400"
          placeholder="Escribe el campeon"
        />
        <button
          :disabled="savingChampion"
          class="rounded-xl bg-emerald-400/25 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-60"
          @click="saveChampion"
        >
          {{ savingChampion ? "Guardando..." : "Guardar campeon" }}
        </button>
      </div>
    </article>

    <article
      v-if="loading"
      class="pitch-panel rounded-2xl p-5 text-sm text-(--text-muted)"
    >
      Cargando ranking...
    </article>
    <article
      v-else-if="errorMessage"
      class="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-sm text-red-200"
    >
      {{ errorMessage }}
    </article>
    <article
      v-else
      class="overflow-hidden rounded-2xl border border-white/8 bg-black/25"
    >
      <table class="min-w-full text-sm">
        <thead
          class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
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
            class="border-t border-white/8"
          >
            <td class="px-4 py-3 font-semibold text-emerald-200">
              {{ row.rank }}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img
                  v-if="row.avatar_url"
                  :src="row.avatar_url"
                  alt="avatar"
                  class="h-7 w-7 rounded-full border border-white/15 object-cover"
                />
                <div
                  v-else
                  class="grid h-7 w-7 place-content-center rounded-full bg-emerald-400/20 text-xs font-bold text-emerald-100"
                >
                  {{ row.username.slice(0, 1).toUpperCase() }}
                </div>
                <span>{{ row.username }}</span>
              </div>
            </td>
            <td class="px-4 py-3 font-semibold">{{ row.total_points }}</td>
            <td class="px-4 py-3 text-(--text-muted)">
              {{ row.predicted_champion || "-" }}
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  </section>
</template>
