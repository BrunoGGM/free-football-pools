<script setup lang="ts">
const route = useRoute();
const user = useSupabaseUser();
const { signOut, loading } = useSupabaseAuth();
const { clearActiveQuiniela, quiniela, loadActiveQuiniela, activeQuinielaId } =
  useActiveQuiniela();

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/mi-quiniela", label: "Mi quiniela" },
  { to: "/dashboard/grupos", label: "Grupos" },
  { to: "/dashboard/eliminatorias", label: "Eliminatorias" },
  { to: "/dashboard/posiciones", label: "Posiciones" },
  { to: "/admin", label: "Admin" },
];

const availableThemes = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk",
] as const;

type ThemeName = (typeof availableThemes)[number];
const selectedTheme = ref<ThemeName>("dark");

const isThemeName = (value: string): value is ThemeName => {
  return availableThemes.includes(value as ThemeName);
};

const setTheme = (theme: ThemeName) => {
  selectedTheme.value = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("quiniela-theme", theme);
};

const onThemeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement | null;
  if (!target) {
    return;
  }

  if (isThemeName(target.value)) {
    setTheme(target.value);
  }
};

const isActive = (path: string) => {
  return (
    route.path === path ||
    (path !== "/dashboard" && route.path.startsWith(path))
  );
};

const logout = async () => {
  const ok = await signOut();

  if (!ok) {
    return;
  }

  clearActiveQuiniela();
  await navigateTo("/");
};

onMounted(() => {
  const storedTheme = localStorage.getItem("quiniela-theme");

  if (storedTheme && isThemeName(storedTheme)) {
    setTheme(storedTheme);
  } else {
    setTheme("dark");
  }

  if (user.value) {
    void loadActiveQuiniela();
  }
});

watch(
  () => activeQuinielaId.value,
  () => {
    if (user.value) {
      void loadActiveQuiniela();
    }
  },
);
</script>

<template>
  <div class="min-h-screen">
    <header
      class="bg-base-200/80 sticky top-0 z-20 border-b border-base-300 backdrop-blur-xl"
    >
      <div
        class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <NuxtLink to="/" class="flex items-center gap-3">
          <div
            class="text-primary bg-primary/15 grid h-9 w-9 place-content-center rounded-xl neon-border"
          >
            <span class="logo-font text-lg leading-none">Q</span>
          </div>
          <div>
            <p class="logo-font text-primary text-xl uppercase leading-none">
              Quiniela 2026
            </p>
            <p class="text-base-content/70 text-xs">Modo torneo en vivo</p>
          </div>
        </NuxtLink>

        <nav class="hidden items-center gap-2 lg:flex" v-if="user">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="btn btn-sm"
            :class="[isActive(link.to) ? 'btn-primary' : 'btn-outline']"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-2">
          <label for="theme-selector" class="sr-only">Tema</label>
          <select
            id="theme-selector"
            class="select select-bordered select-sm w-44"
            :value="selectedTheme"
            @change="onThemeChange"
          >
            <option
              v-for="theme in availableThemes"
              :key="theme"
              :value="theme"
            >
              {{ theme }}
            </option>
          </select>

          <NuxtLink v-if="!user" to="/auth" class="btn btn-primary btn-sm">
            Iniciar sesion
          </NuxtLink>
          <button
            v-else
            :disabled="loading"
            class="btn btn-outline btn-error btn-sm"
            @click="logout"
          >
            {{ loading ? "Saliendo..." : "Salir" }}
          </button>
        </div>
      </div>

      <div v-if="user" class="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6">
        <div
          v-if="quiniela"
          class="card rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3"
        >
          <p class="text-primary text-xs uppercase tracking-[0.14em]">
            Quiniela activa
          </p>
          <p class="text-base-content mt-1 text-lg font-semibold sm:text-xl">
            {{ quiniela.name }}
          </p>
        </div>
        <div v-else class="alert alert-warning rounded-2xl px-4 py-3">
          <p class="text-xs uppercase tracking-[0.14em]">Sin quiniela activa</p>
          <NuxtLink
            to="/ingresar"
            class="link link-hover mt-1 inline-flex text-sm font-semibold"
          >
            Seleccionar o unirme a una quiniela
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>
  </div>
</template>
