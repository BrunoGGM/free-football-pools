<script setup lang="ts">
definePageMeta({
  middleware: ["guest"],
});

type Mode = "login" | "register";

const route = useRoute();
const mode = ref<Mode>(route.query.mode === "register" ? "register" : "login");

const email = ref("");
const password = ref("");
const username = ref("");

const {
  loading,
  errorMessage,
  resetError,
  signInWithPassword,
  signUpWithPassword,
} = useSupabaseAuth();

const title = computed(() =>
  mode.value === "login" ? "Iniciar sesion" : "Crear cuenta",
);
const actionLabel = computed(() =>
  mode.value === "login" ? "Entrar" : "Registrarme",
);

watch(
  () => route.query.mode,
  (newMode) => {
    mode.value = newMode === "register" ? "register" : "login";
    resetError();
  },
);

watch(mode, () => {
  resetError();
});

const setMode = (nextMode: Mode) => {
  mode.value = nextMode;
  void navigateTo(`/auth?mode=${nextMode}`, { replace: true });
};

const submit = async () => {
  if (mode.value === "login") {
    const ok = await signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (ok) {
      await navigateTo("/dashboard");
    }

    return;
  }

  const ok = await signUpWithPassword({
    email: email.value,
    password: password.value,
    username: username.value,
  });

  if (ok) {
    await navigateTo("/dashboard");
  }
};
</script>

<template>
  <section class="mx-auto max-w-xl">
    <div class="pitch-panel neon-border rounded-3xl p-6 sm:p-8">
      <div
        class="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 p-1"
      >
        <button
          class="w-full rounded-full px-4 py-2 text-sm font-semibold transition"
          :class="
            mode === 'login'
              ? 'bg-emerald-400/20 text-emerald-100'
              : 'text-slate-300 hover:text-white'
          "
          @click="setMode('login')"
        >
          Iniciar sesion
        </button>
        <button
          class="w-full rounded-full px-4 py-2 text-sm font-semibold transition"
          :class="
            mode === 'register'
              ? 'bg-emerald-400/20 text-emerald-100'
              : 'text-slate-300 hover:text-white'
          "
          @click="setMode('register')"
        >
          Registrarse
        </button>
      </div>

      <h1 class="mt-6 text-3xl text-white">{{ title }}</h1>
      <p class="mt-2 text-sm text-(--text-muted)">
        Entra a tu quiniela privada y prepara tus predicciones antes de cada
        kickoff.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'register'" class="space-y-1">
          <label class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >Username</label
          >
          <input
            v-model="username"
            required
            minlength="3"
            maxlength="32"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400"
            placeholder="tu_usuario"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >Email</label
          >
          <input
            v-model="email"
            required
            type="email"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400"
            placeholder="mail@ejemplo.com"
          />
        </div>

        <div class="space-y-1">
          <label class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >Password</label
          >
          <input
            v-model="password"
            required
            minlength="6"
            type="password"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400"
            placeholder="******"
          />
        </div>

        <button
          :disabled="loading"
          class="w-full rounded-xl bg-emerald-400/25 px-4 py-3 font-semibold text-emerald-100 transition hover:bg-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-55"
          type="submit"
        >
          {{ loading ? "Procesando..." : actionLabel }}
        </button>
      </form>

      <p
        v-if="errorMessage"
        class="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
      >
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>
