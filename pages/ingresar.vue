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
    .select("id, name, has_test_data")
    .eq("access_code", code)
    .maybeSingle();

  if (quinielaError || !quiniela) {
    loading.value = false;
    errorMessage.value =
      quinielaError?.message ?? "No se encontro una quiniela con ese codigo.";
    return;
  }

  if (Boolean(quiniela.has_test_data)) {
    loading.value = false;
    errorMessage.value =
      "Esta quiniela esta en modo pruebas y se encuentra bloqueada para usuarios reales.";
    return;
  }

  const { error: memberError } = await client.from("quiniela_members").insert({
    user_id: user.value.id,
    quiniela_id: quiniela.id,
  });

  loading.value = false;

  if (memberError && memberError.code !== "23505") {
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
      class="alert alert-warning rounded-3xl border border-base-300 p-6 shadow-lg sm:p-7"
    >
      <p class="text-xs font-semibold uppercase tracking-[0.16em]">Atencion</p>
      <h2 class="mt-2 text-2xl sm:text-3xl">
        Aun no has ingresado a ninguna quiniela
      </h2>
      <p class="mt-3 text-sm sm:text-base">
        Ingresa un codigo para unirte y activar tu dashboard de predicciones.
      </p>
    </article>

    <article
      v-else
      class="pitch-panel card rounded-3xl border border-base-300 bg-base-200/70 p-5 shadow-lg sm:p-6"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-primary text-xl">Tus quinielas</h2>
        <span class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
          {{ myQuinielas.length }} activas
        </span>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
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
          <p class="text-base-content text-sm font-semibold">
            {{ membership.quiniela?.name || "Quiniela" }}
          </p>
          <p class="text-base-content/70 mt-1 text-xs">
            {{ membership.quiniela?.description || "Sin descripcion." }}
          </p>
          <p class="text-primary mt-2 text-xs font-semibold">
            Boleto:
            {{
              Number(membership.quiniela?.ticket_price || 0).toLocaleString(
                "es-MX",
                {
                  style: "currency",
                  currency: "MXN",
                },
              )
            }}
          </p>
          <p class="text-warning mt-2 text-xs">
            Puntos actuales: {{ membership.total_points }}
          </p>
        </button>
      </div>
    </article>

    <article
      class="pitch-panel card neon-border rounded-3xl border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <p class="text-primary text-xs uppercase tracking-[0.18em]">
        Unirse a quiniela
      </p>
      <h1 class="text-base-content mt-2 text-3xl">
        Ingresa tu codigo de acceso
      </h1>
      <p class="text-base-content/70 mt-3 text-sm">
        Usa el codigo que te compartio el admin para entrar a la sala privada.
      </p>
      <p class="alert alert-info mt-2 rounded-xl px-3 py-2 text-xs">
        Puedes editar tus predicciones hasta antes del kickoff. Los resultados
        oficiales del partido solo se actualizan por administracion.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >Access code</label
          >
          <input
            v-model="accessCode"
            maxlength="12"
            required
            class="input input-bordered w-full text-center text-lg font-semibold uppercase tracking-[0.2em]"
            placeholder="ABC123"
          />
        </div>

        <button
          :disabled="loading"
          class="btn btn-primary w-full"
          type="submit"
        >
          {{ loading ? "Validando..." : "Unirme a la quiniela" }}
        </button>
      </form>

      <p v-if="errorMessage" class="alert alert-error mt-4 text-sm">
        {{ errorMessage }}
      </p>
    </article>
  </section>
</template>
