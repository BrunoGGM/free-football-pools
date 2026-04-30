<script setup lang="ts">
definePageMeta({
  middleware: ["guest"],
});

type Mode = "login" | "register";

const route = useRoute();
const mode = ref<Mode>(route.query.mode === "register" ? "register" : "login");

const redirectPath = computed(() => {
  const raw = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect;

  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
});

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
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

  if (nextMode === "login") {
    confirmPassword.value = "";
  }

  void navigateTo(
    {
      path: "/auth",
      query: {
        mode: nextMode,
        redirect: redirectPath.value !== "/dashboard" ? redirectPath.value : undefined,
      },
    },
    { replace: true },
  );
};

const submit = async () => {
  if (mode.value === "login") {
    const ok = await signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (ok) {
      await navigateTo(redirectPath.value);
    }

    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Las contraseñas no coinciden.";
    return;
  }

  const ok = await signUpWithPassword({
    email: email.value,
    password: password.value,
    username: username.value,
  });

  if (ok) {
    await navigateTo(redirectPath.value);
  }
};
</script>

<template>
  <section class="mx-auto max-w-xl">
    <div
      class="pitch-panel card neon-border rounded-3xl border border-base-300 bg-base-200/70 p-6 shadow-xl sm:p-8"
    >
      <div class="tabs tabs-boxed bg-base-100/70 p-1">
        <button
          class="tab w-full text-sm font-semibold"
          :class="
            mode === 'login'
              ? 'tab-active text-primary'
              : 'text-base-content/70'
          "
          @click="setMode('login')"
        >
          Iniciar sesion
        </button>
        <button
          class="tab w-full text-sm font-semibold"
          :class="
            mode === 'register'
              ? 'tab-active text-primary'
              : 'text-base-content/70'
          "
          @click="setMode('register')"
        >
          Registrarse
        </button>
      </div>

      <h1 class="text-base-content mt-6 text-3xl">{{ title }}</h1>
      <p class="text-base-content/70 mt-2 text-sm">
        Entra a tu quiniela privada y prepara tus predicciones antes de cada
        kickoff.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div v-if="mode === 'register'" class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >Username</label
          >
          <input
            v-model="username"
            required
            minlength="3"
            maxlength="32"
            class="input input-bordered w-full"
            placeholder="tu_usuario"
          />
        </div>

        <div class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >Email</label
          >
          <input
            v-model="email"
            required
            type="email"
            class="input input-bordered w-full"
            placeholder="mail@ejemplo.com"
          />
        </div>

        <div class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >Password</label
          >
          <input
            v-model="password"
            required
            minlength="6"
            type="password"
            class="input input-bordered w-full"
            placeholder="******"
          />
        </div>

        <div v-if="mode === 'register'" class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >Confirmar password</label
          >
          <input
            v-model="confirmPassword"
            required
            minlength="6"
            type="password"
            class="input input-bordered w-full"
            placeholder="******"
          />
        </div>

        <button
          :disabled="loading"
          class="btn btn-primary w-full"
          type="submit"
        >
          {{ loading ? "Procesando..." : actionLabel }}
        </button>
      </form>

      <p v-if="errorMessage" class="alert alert-error mt-4 text-sm">
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>
