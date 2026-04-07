<script setup lang="ts">
const route = useRoute();
const client = useSupabaseClient<any>();
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

interface HeaderMetric {
  label: string;
  value: string;
  highlight?: boolean;
}

const headerMetrics = ref<HeaderMetric[]>([]);
let metricsRefreshTimer: ReturnType<typeof setInterval> | null = null;
const soundEnabled = ref(true);
let audioContext: AudioContext | null = null;
let clickSoundListener: ((event: PointerEvent) => void) | null = null;
let celebrationSoundListener: ((event: Event) => void) | null = null;
let lastSoundAt = 0;

const ensureAudioContext = () => {
  if (!process.client || !soundEnabled.value) {
    return null;
  }

  if (!audioContext) {
    const Context = window.AudioContext || (window as any).webkitAudioContext;
    if (!Context) {
      return null;
    }
    audioContext = new Context();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
};

const playSoftTone = (
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType,
  offset = 0,
) => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime + offset;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
};

const playSoftClick = () => {
  playSoftTone(420, 0.07, 0.012, "triangle");
};

const playSoftSuccess = () => {
  playSoftTone(620, 0.13, 0.014, "sine");
  playSoftTone(860, 0.15, 0.01, "triangle", 0.06);
};

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value;
  localStorage.setItem("quiniela-sound", soundEnabled.value ? "on" : "off");
};

const formatKickoff = (value: string | null) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatMoney = (amount: number) => {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const loadHeaderMetrics = async () => {
  if (!user.value || !activeQuinielaId.value) {
    headerMetrics.value = [];
    return;
  }

  const [liveRes, pendingRes, finishedRes, membersRes, nextKickoffRes] =
    await Promise.all([
      client
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      client
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      client
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "finished"),
      client
        .from("quiniela_members")
        .select("user_id, total_points", { count: "exact" })
        .eq("quiniela_id", activeQuinielaId.value)
        .order("total_points", { ascending: false }),
      client
        .from("matches")
        .select("match_time")
        .eq("status", "pending")
        .order("match_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  if (
    liveRes.error ||
    pendingRes.error ||
    finishedRes.error ||
    membersRes.error ||
    nextKickoffRes.error
  ) {
    return;
  }

  const members =
    (membersRes.data as Array<{
      user_id: string;
      total_points: number | null;
    }> | null) ?? [];

  const ownIndex = members.findIndex(
    (member) => member.user_id === user.value?.id,
  );
  const ownRow = ownIndex >= 0 ? members[ownIndex] : null;
  const memberCount = Number(membersRes.count ?? members.length ?? 0);
  const liveCount = Number(liveRes.count ?? 0);
  const pendingCount = Number(pendingRes.count ?? 0);
  const finishedCount = Number(finishedRes.count ?? 0);
  const ticketPrice = Number(quiniela.value?.ticket_price ?? 0);
  const totalPot = ticketPrice * memberCount;

  headerMetrics.value = [
    { label: "En vivo", value: String(liveCount) },
    { label: "Pendientes", value: String(pendingCount) },
    { label: "Finalizados", value: String(finishedCount) },
    { label: "Jugadores", value: String(memberCount) },
    {
      label: "Premio 1er lugar",
      value: formatMoney(totalPot),
      highlight: true,
    },
    { label: "Mis puntos", value: String(Number(ownRow?.total_points ?? 0)) },
    {
      label: "Mi puesto",
      value:
        ownIndex >= 0 && memberCount > 0
          ? `#${ownIndex + 1}/${memberCount}`
          : "-",
    },
    {
      label: "Prox. kickoff",
      value: formatKickoff(
        (nextKickoffRes.data?.match_time as string | null) ?? null,
      ),
    },
  ];
};

const metricsTape = computed(() => [
  ...headerMetrics.value,
  ...headerMetrics.value,
]);

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

  const storedSound = localStorage.getItem("quiniela-sound");
  soundEnabled.value = storedSound !== "off";

  if (user.value) {
    void loadActiveQuiniela();
    void loadHeaderMetrics();

    metricsRefreshTimer = setInterval(() => {
      void loadHeaderMetrics();
    }, 30000);
  }

  clickSoundListener = (event: PointerEvent) => {
    if (!soundEnabled.value) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const actionable = target.closest("button, a, [role='button'], .btn");
    if (!actionable) {
      return;
    }

    const now = Date.now();
    if (now - lastSoundAt < 70) {
      return;
    }

    lastSoundAt = now;
    playSoftClick();
  };

  celebrationSoundListener = () => {
    if (!soundEnabled.value) {
      return;
    }

    playSoftSuccess();
  };

  document.addEventListener("pointerdown", clickSoundListener);
  window.addEventListener("quiniela:celebration", celebrationSoundListener);
});

watch(
  () => activeQuinielaId.value,
  () => {
    if (user.value) {
      void loadActiveQuiniela();
      void loadHeaderMetrics();
    }
  },
);

watch(
  () => quiniela.value?.ticket_price,
  () => {
    if (user.value) {
      void loadHeaderMetrics();
    }
  },
);

watch(
  () => user.value?.id,
  () => {
    if (user.value) {
      void loadHeaderMetrics();
      return;
    }

    headerMetrics.value = [];
  },
);

onBeforeUnmount(() => {
  if (metricsRefreshTimer) {
    clearInterval(metricsRefreshTimer);
  }

  if (clickSoundListener) {
    document.removeEventListener("pointerdown", clickSoundListener);
  }

  if (celebrationSoundListener) {
    window.removeEventListener(
      "quiniela:celebration",
      celebrationSoundListener,
    );
  }

  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close();
    audioContext = null;
  }
});
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

          <button class="btn btn-outline btn-sm" @click="toggleSound">
            {{ soundEnabled ? "Sonido ON" : "Sonido OFF" }}
          </button>

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

      <div v-if="user && metricsTape.length" class="odds-strip">
        <div class="odds-track">
          <span
            v-for="(item, index) in metricsTape"
            :key="`${item.label}-${index}`"
            class="odds-chip"
            :class="item.highlight && 'odds-chip-pot'"
          >
            <span class="odds-market">{{ item.label }}</span>
            <strong
              class="odds-price"
              :class="item.highlight && 'odds-price-pot'"
              >{{ item.value }}</strong
            >
          </span>
        </div>
      </div>
    </header>

    <main
      class="arena-entry mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
    >
      <slot />
    </main>
  </div>
</template>
