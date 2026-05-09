<script setup lang="ts">
definePageMeta({
  middleware: ["guest"],
});

type Mode = "login" | "register" | "reset" | "update-password";

const route = useRoute();
const client = useSupabaseClient<any>();

const readMode = (value: unknown): Mode => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "register" || raw === "reset" || raw === "update-password") {
    return raw;
  }

  return "login";
};

const mode = ref<Mode>(readMode(route.query.mode));

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
const successMessage = ref<string | null>(null);

const {
  loading,
  errorMessage,
  resetError,
  signInWithPassword,
  signUpWithPassword,
  resetPasswordForEmail,
  updatePassword,
} = useSupabaseAuth();

const title = computed(() => {
  if (mode.value === "register") {
    return "Crear cuenta";
  }

  if (mode.value === "reset") {
    return "Restablecer contrasena";
  }

  if (mode.value === "update-password") {
    return "Nueva contrasena";
  }

  return "Iniciar sesion";
});

const actionLabel = computed(() => {
  if (mode.value === "register") {
    return "Registrarme";
  }

  if (mode.value === "reset") {
    return "Enviar enlace";
  }

  if (mode.value === "update-password") {
    return "Actualizar contrasena";
  }

  return "Entrar";
});

const helperText = computed(() => {
  if (mode.value === "reset") {
    return "Te enviaremos un enlace seguro para crear una contrasena nueva.";
  }

  if (mode.value === "update-password") {
    return "Define una contrasena nueva para recuperar el acceso a tu cuenta.";
  }

  return "Entra a tu quiniela privada y prepara tus predicciones antes de cada kickoff.";
});

watch(
  () => route.query.mode,
  (newMode) => {
    mode.value = readMode(newMode);
    resetError();
    successMessage.value = null;
  },
);

watch(mode, () => {
  resetError();
  successMessage.value = null;
});

const setMode = (nextMode: Mode) => {
  mode.value = nextMode;

  if (nextMode !== "register") {
    confirmPassword.value = "";
  }

  if (nextMode === "reset") {
    password.value = "";
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

const recoveryRedirectTo = () => {
  if (!process.client) {
    return undefined;
  }

  return `${window.location.origin}/auth?mode=update-password`;
};

onMounted(async () => {
  if (!process.client) {
    return;
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const recoveryType =
    (Array.isArray(route.query.type) ? route.query.type[0] : route.query.type) ||
    hashParams.get("type");
  const code = Array.isArray(route.query.code)
    ? route.query.code[0]
    : route.query.code;

  if (typeof code === "string" && code) {
    await client.auth.exchangeCodeForSession(code);
    mode.value = "update-password";
    await navigateTo({ path: "/auth", query: { mode: "update-password" } }, { replace: true });
    return;
  }

  if (recoveryType === "recovery") {
    mode.value = "update-password";
  }
});

const submit = async () => {
  successMessage.value = null;

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

  if (mode.value === "reset") {
    const ok = await resetPasswordForEmail({
      email: email.value,
      redirectTo: recoveryRedirectTo(),
    });

    if (ok) {
      successMessage.value =
        "Si el correo existe, recibiras un enlace para restablecer tu contrasena.";
    }

    return;
  }

  if (mode.value === "update-password") {
    if (password.value.length < 6) {
      errorMessage.value = "La contrasena debe tener al menos 6 caracteres.";
      return;
    }

    if (password.value !== confirmPassword.value) {
      errorMessage.value = "Las contrasenas no coinciden.";
      return;
    }

    const ok = await updatePassword(password.value);

    if (ok) {
      successMessage.value = "Contrasena actualizada correctamente.";
      await navigateTo("/dashboard");
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
      <p class="text-base-content/70 mt-2 text-sm">{{ helperText }}</p>

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

        <div v-if="mode !== 'update-password'" class="form-control space-y-1">
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

        <div v-if="mode !== 'reset'" class="form-control space-y-1">
          <label
            class="label-text text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >{{ mode === "update-password" ? "Nueva password" : "Password" }}</label
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

        <div
          v-if="mode === 'register' || mode === 'update-password'"
          class="form-control space-y-1"
        >
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

      <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          v-if="mode === 'login'"
          type="button"
          class="link link-hover text-info"
          @click="setMode('reset')"
        >
          Olvide mi contrasena
        </button>
        <button
          v-if="mode === 'reset' || mode === 'update-password'"
          type="button"
          class="link link-hover text-info"
          @click="setMode('login')"
        >
          Volver a iniciar sesion
        </button>
      </div>

      <p v-if="errorMessage" class="alert alert-error mt-4 text-sm">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="alert alert-success mt-4 text-sm">
        {{ successMessage }}
      </p>
    </div>
  </section>
</template>
