<script setup lang="ts">
const route = useRoute();
const user = useSupabaseUser();
const { signOut, loading } = useSupabaseAuth();
const { clearActiveQuiniela } = useActiveQuiniela();

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/grupos", label: "Grupos" },
  { to: "/dashboard/eliminatorias", label: "Eliminatorias" },
  { to: "/dashboard/posiciones", label: "Posiciones" },
  { to: "/admin", label: "Admin" },
];

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
</script>

<template>
  <div class="min-h-screen">
    <header
      class="sticky top-0 z-20 border-b border-emerald-500/25 bg-black/40 backdrop-blur-xl"
    >
      <div
        class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <NuxtLink to="/" class="flex items-center gap-3">
          <div
            class="grid h-9 w-9 place-content-center rounded-xl bg-emerald-400/15 text-emerald-300 neon-border"
          >
            <span class="logo-font text-lg leading-none">Q</span>
          </div>
          <div>
            <p
              class="logo-font text-xl uppercase leading-none text-emerald-300"
            >
              Quiniela 2026
            </p>
            <p class="text-xs text-(--text-muted)">Modo torneo en vivo</p>
          </div>
        </NuxtLink>

        <nav class="hidden items-center gap-2 lg:flex" v-if="user">
          <NuxtLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-full px-3 py-2 text-sm transition"
            :class="[
              isActive(link.to)
                ? 'bg-emerald-400/20 text-emerald-200 shadow-[0_0_18px_rgba(0,245,160,0.2)]'
                : 'text-slate-300 hover:bg-white/6 hover:text-white',
            ]"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-2">
          <NuxtLink
            v-if="!user"
            to="/auth"
            class="rounded-full border border-emerald-400/40 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/10"
          >
            Iniciar sesion
          </NuxtLink>
          <button
            v-else
            :disabled="loading"
            class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 transition hover:border-red-300/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            @click="logout"
          >
            {{ loading ? "Saliendo..." : "Salir" }}
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <slot />
    </main>
  </div>
</template>
