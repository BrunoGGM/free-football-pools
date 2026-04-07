<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const user = useSupabaseUser();
const client = useSupabaseClient<any>();
const {
  setActiveQuiniela,
  myQuinielas,
  loadMyQuinielas,
  activeQuinielaId,
  loadActiveQuiniela,
} = useActiveQuiniela();

const accessCode = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);

onMounted(() => {
  void loadMyQuinielas();
});

const hasAnyQuiniela = computed(() => myQuinielas.value.length > 0);

const selectQuiniela = async (quinielaId: string) => {
  setActiveQuiniela(quinielaId);
  await loadActiveQuiniela();
  await navigateTo("/dashboard");
};

const submit = async () => {
  if (!user.value) {
    return;
  }

  const code = accessCode.value.trim().toUpperCase();

  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    errorMessage.value =
      "Codigo invalido. Usa 6 a 12 caracteres alfanumericos.";
    return;
  }

  loading.value = true;
  errorMessage.value = null;

  const { data: quiniela, error: quinielaError } = await client
    .from("quinielas")
    .select("id, name")
    .eq("access_code", code)
    .maybeSingle();

  if (quinielaError || !quiniela) {
    loading.value = false;
    errorMessage.value =
      quinielaError?.message ?? "No se encontro una quiniela con ese codigo.";
    return;
  }

  const { error: memberError } = await client.from("quiniela_members").upsert(
    {
      user_id: user.value.id,
      quiniela_id: quiniela.id,
    },
    { onConflict: "user_id,quiniela_id" },
  );

  loading.value = false;

  if (memberError) {
    errorMessage.value = memberError.message;
    return;
  }

  setActiveQuiniela(quiniela.id);
  await navigateTo("/dashboard");
};
</script>

<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <article
      v-if="!hasAnyQuiniela"
      class="rounded-3xl border border-amber-300/30 bg-amber-500/12 p-6 sm:p-7"
    >
      <p
        class="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200"
      >
        Atencion
      </p>
      <h2 class="mt-2 text-2xl text-amber-100 sm:text-3xl">
        Aun no has ingresado a ninguna quiniela
      </h2>
      <p class="mt-3 text-sm text-amber-100/90 sm:text-base">
        Ingresa un codigo para unirte y activar tu dashboard de predicciones.
      </p>
    </article>

    <article
      v-else
      class="pitch-panel rounded-3xl border border-white/10 p-5 sm:p-6"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xl text-emerald-200">Tus quinielas</h2>
        <span class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          {{ myQuinielas.length }} activas
        </span>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
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

    <article class="pitch-panel neon-border rounded-3xl p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
        Unirse a quiniela
      </p>
      <h1 class="mt-2 text-3xl text-white">Ingresa tu codigo de acceso</h1>
      <p class="mt-3 text-sm text-(--text-muted)">
        Usa el codigo que te compartio el admin para entrar a la sala privada.
      </p>
      <p
        class="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200"
      >
        Puedes editar tus predicciones hasta antes del kickoff. Los resultados
        oficiales del partido solo se actualizan por administracion.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="space-y-1">
          <label class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >Access code</label
          >
          <input
            v-model="accessCode"
            maxlength="12"
            required
            class="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center text-lg font-semibold uppercase tracking-[0.2em] text-slate-100 outline-none transition focus:border-emerald-400"
            placeholder="ABC123"
          />
        </div>

        <button
          :disabled="loading"
          class="w-full rounded-xl bg-emerald-400/25 px-4 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-55"
          type="submit"
        >
          {{ loading ? "Validando..." : "Unirme a la quiniela" }}
        </button>
      </form>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
      >
        {{ errorMessage }}
      </p>
    </article>
  </section>
</template>
