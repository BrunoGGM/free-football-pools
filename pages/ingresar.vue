<script setup lang="ts">
definePageMeta({
  middleware: ["auth"],
});

const user = useSupabaseUser();
const client = useSupabaseClient<any>();
const { setActiveQuiniela } = useActiveQuiniela();

const accessCode = ref("");
const loading = ref(false);
const errorMessage = ref<string | null>(null);

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
  <section class="mx-auto max-w-lg">
    <article class="pitch-panel neon-border rounded-3xl p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.18em] text-emerald-200">
        Unirse a quiniela
      </p>
      <h1 class="mt-2 text-3xl text-white">Ingresa tu codigo de acceso</h1>
      <p class="mt-3 text-sm text-(--text-muted)">
        Usa el codigo que te compartio el admin para entrar a la sala privada.
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
