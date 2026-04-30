<script setup lang="ts">
const route = useRoute();
const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const { signOut, loading } = useSupabaseAuth();
const {
  clearActiveQuiniela,
  quiniela,
  loadActiveQuiniela,
  activeQuinielaId,
  myQuinielas,
  loadMyQuinielas,
  setActiveQuiniela,
} = useActiveQuiniela();
const { lastEvent } = useGameUx();

const canAccessAdmin = ref(false);
const desktopPartidosDetails = ref<HTMLDetailsElement | null>(null);
const mobilePartidosDetails = ref<HTMLDetailsElement | null>(null);
const isPartidosActive = computed(() => {
  return isActive("/dashboard/grupos") || isActive("/dashboard/eliminatorias");
});

const closePartidosMenus = () => {
  if (desktopPartidosDetails.value) {
    desktopPartidosDetails.value.open = false;
  }

  if (mobilePartidosDetails.value) {
    mobilePartidosDetails.value.open = false;
  }

  if (process.client && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

interface HeaderMetric {
  label: string;
  value: string;
  tone:
    | "live"
    | "pending"
    | "finished"
    | "members"
    | "leader"
    | "pot"
    | "score"
    | "rank"
    | "kickoff";
  icon: string;
}

const headerMetrics = ref<HeaderMetric[]>([]);
let metricsRefreshTimer: ReturnType<typeof setInterval> | null = null;
const soundEnabled = ref(true);
const switchingQuiniela = ref(false);
let audioContext: AudioContext | null = null;
let clickSoundListener: ((event: PointerEvent) => void) | null = null;
let lastSoundAt = 0;

const sessionUserName = computed(() => {
  if (!user.value) {
    return "Invitado";
  }

  const metaUsername = user.value.user_metadata?.username;
  if (typeof metaUsername === "string" && metaUsername.trim()) {
    return metaUsername.trim();
  }

  const metaFullName = user.value.user_metadata?.full_name;
  if (typeof metaFullName === "string" && metaFullName.trim()) {
    return metaFullName.trim();
  }

  const email = user.value.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0] || "Jugador";
  }

  return "Jugador";
});

const brandName = computed(() => quiniela.value?.name || "Quiniela 2026");
const brandSubtitle = computed(() =>
  quiniela.value ? "Quiniela activa" : "Modo torneo en vivo",
);

const onActiveQuinielaChange = async (event: Event) => {
  const target = event.target as HTMLSelectElement | null;
  if (!target || switchingQuiniela.value) {
    return;
  }

  const nextId = target.value || null;

  if (nextId === activeQuinielaId.value) {
    return;
  }

  switchingQuiniela.value = true;
  setActiveQuiniela(nextId);

  await Promise.all([
    loadActiveQuiniela(),
    loadHeaderMetrics(),
    loadAdminAccess(),
  ]);

  switchingQuiniela.value = false;
};

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

const playExactHit = () => {
  playSoftTone(780, 0.12, 0.016, "sine");
  playSoftTone(980, 0.14, 0.012, "triangle", 0.05);
  playSoftTone(1280, 0.16, 0.009, "triangle", 0.11);
};

const playRankUp = () => {
  playSoftTone(540, 0.09, 0.014, "triangle");
  playSoftTone(740, 0.1, 0.012, "sine", 0.05);
  playSoftTone(920, 0.12, 0.01, "triangle", 0.1);
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

const isMissingRankingTableError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();

  return (
    error?.code === "42P01" ||
    (message.includes("quiniela_rankings") && message.includes("exist"))
  );
};

const loadHeaderMetrics = async () => {
  if (!user.value || !activeQuinielaId.value) {
    headerMetrics.value = [];
    return;
  }

  const [
    liveRes,
    pendingRes,
    finishedRes,
    membersRes,
    nextKickoffRes,
    rankingRes,
  ] = await Promise.all([
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
    client
      .from("quiniela_rankings")
      .select("user_id, total_points, rank")
      .eq("quiniela_id", activeQuinielaId.value)
      .order("rank", { ascending: true })
      .order("total_points", { ascending: false }),
  ]);

  if (
    liveRes.error ||
    pendingRes.error ||
    finishedRes.error ||
    membersRes.error ||
    nextKickoffRes.error ||
    (rankingRes.error && !isMissingRankingTableError(rankingRes.error))
  ) {
    return;
  }

  const members =
    (membersRes.data as Array<{
      user_id: string;
      total_points: number | null;
    }> | null) ?? [];

  let rankingRows: Array<{
    user_id: string;
    total_points: number;
    rank: number;
  }> = [];

  if (rankingRes.error) {
    let previousPoints: number | null = null;
    let previousRank = 0;

    rankingRows = members.map((member, index) => {
      const currentPoints = Number(member.total_points ?? 0);
      const rank =
        previousPoints !== null && currentPoints === previousPoints
          ? previousRank
          : index + 1;

      previousPoints = currentPoints;
      previousRank = rank;

      return {
        user_id: member.user_id,
        total_points: currentPoints,
        rank,
      };
    });
  } else {
    rankingRows =
      (
        rankingRes.data as Array<{
          user_id: string;
          total_points: number | null;
          rank: number | null;
        }> | null
      )?.map((row, index) => ({
        user_id: row.user_id,
        total_points: Number(row.total_points ?? 0),
        rank: Number(row.rank ?? index + 1),
      })) ?? [];
  }

  const ownIndex = rankingRows.findIndex(
    (member) => member.user_id === user.value?.id,
  );
  const ownRow = ownIndex >= 0 ? rankingRows[ownIndex] : null;
  const ownRank = ownRow?.rank ?? null;
  const memberCount = Number(membersRes.count ?? members.length ?? 0);
  const liveCount = Number(liveRes.count ?? 0);
  const pendingCount = Number(pendingRes.count ?? 0);
  const finishedCount = Number(finishedRes.count ?? 0);
  const ticketPrice = Number(quiniela.value?.ticket_price ?? 0);
  const totalPot = ticketPrice * memberCount;
  const leader = rankingRows[0] ?? null;
  const leaderPoints = Number(leader?.total_points ?? 0);
  let leaderName = "-";

  if (leader?.user_id) {
    if (leader.user_id === user.value?.id) {
      leaderName = sessionUserName.value;
    } else {
      const { data: leaderProfile, error: leaderProfileError } = await client
        .from("profiles")
        .select("username")
        .eq("id", leader.user_id)
        .maybeSingle();

      if (!leaderProfileError && typeof leaderProfile?.username === "string") {
        leaderName = leaderProfile.username || "Jugador";
      } else {
        leaderName = "Jugador";
      }
    }
  }

  headerMetrics.value = [
    { label: "En vivo", value: String(liveCount), tone: "live", icon: "●" },
    {
      label: "Pendientes",
      value: String(pendingCount),
      tone: "pending",
      icon: "⏳",
    },
    {
      label: "Finalizados",
      value: String(finishedCount),
      tone: "finished",
      icon: "✓",
    },
    {
      label: "Jugadores",
      value: String(memberCount),
      tone: "members",
      icon: "👥",
    },
    {
      label: "Lider actual",
      value: memberCount > 0 ? `${leaderName} (${leaderPoints} pts)` : "-",
      tone: "leader",
      icon: "👑",
    },
    {
      label: "Premio 1er lugar",
      value: formatMoney(totalPot),
      tone: "pot",
      icon: "💰",
    },
    {
      label: "Mis puntos",
      value: String(Number(ownRow?.total_points ?? 0)),
      tone: "score",
      icon: "🎯",
    },
    {
      label: "Mi puesto",
      value:
        ownRank !== null && memberCount > 0
          ? `#${ownRank}/${memberCount}`
          : "-",
      tone: "rank",
      icon: "🏅",
    },
    {
      label: "Prox. kickoff",
      value: formatKickoff(
        (nextKickoffRes.data?.match_time as string | null) ?? null,
      ),
      tone: "kickoff",
      icon: "🕒",
    },
  ];
};

const metricChipClass = (item: HeaderMetric) => {
  return `odds-chip-${item.tone}`;
};

const metricPriceClass = (item: HeaderMetric) => {
  return `odds-price-${item.tone}`;
};

const loadAdminAccess = async () => {
  if (!user.value) {
    canAccessAdmin.value = false;
    return;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("is_global_admin")
    .eq("id", user.value.id)
    .maybeSingle();

  if (!profileError && profile?.is_global_admin) {
    canAccessAdmin.value = true;
    return;
  }

  if (!activeQuinielaId.value) {
    canAccessAdmin.value = false;
    return;
  }

  const { data: adminCheck, error: adminCheckError } = await client
    .from("quinielas")
    .select("id")
    .eq("id", activeQuinielaId.value)
    .eq("admin_id", user.value.id)
    .maybeSingle();

  canAccessAdmin.value = !adminCheckError && Boolean(adminCheck?.id);
};

const tickerMetrics = computed(() => [
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
    void loadMyQuinielas();
    void loadHeaderMetrics();
    void loadAdminAccess();

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

  document.addEventListener("pointerdown", clickSoundListener);
});

watch(
  () => lastEvent.value?.id,
  () => {
    if (!soundEnabled.value || !lastEvent.value) {
      return;
    }

    if (lastEvent.value.type === "prediction-saved") {
      playSoftSuccess();
      return;
    }

    if (lastEvent.value.type === "champion-saved") {
      playSoftSuccess();
      return;
    }

    if (lastEvent.value.type === "exact-hit") {
      playExactHit();
      return;
    }

    if (lastEvent.value.type === "rank-up") {
      playRankUp();
    }
  },
);

watch(
  () => activeQuinielaId.value,
  () => {
    if (user.value) {
      void loadActiveQuiniela();
      void loadMyQuinielas();
      void loadHeaderMetrics();
      void loadAdminAccess();
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
      void loadMyQuinielas();
      void loadHeaderMetrics();
      void loadAdminAccess();
      return;
    }

    headerMetrics.value = [];
    canAccessAdmin.value = false;
  },
);

watch(
  () => route.path,
  () => {
    closePartidosMenus();
  },
);

onBeforeUnmount(() => {
  if (metricsRefreshTimer) {
    clearInterval(metricsRefreshTimer);
  }

  if (clickSoundListener) {
    document.removeEventListener("pointerdown", clickSoundListener);
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
        <NuxtLink to="/" class="flex min-w-0 items-center gap-3">
          <div
            class="text-primary bg-primary/15 grid h-9 w-9 flex-none place-content-center overflow-hidden rounded-xl neon-border"
          >
            <img
              v-if="quiniela?.logo_url"
              :src="quiniela.logo_url"
              :alt="`Logo de ${quiniela.name}`"
              class="h-full w-full object-contain p-1"
            />
            <span v-else class="logo-font text-lg leading-none">Q</span>
          </div>
          <div class="min-w-0">
            <p
              class="logo-font text-primary max-w-36 truncate text-xl uppercase leading-none sm:max-w-52 md:max-w-64"
              :title="brandName"
            >
              {{ brandName }}
            </p>
            <p class="text-base-content/70 text-xs">{{ brandSubtitle }}</p>
          </div>
        </NuxtLink>

        <div v-if="user" class="relative z-30 hidden flex-none lg:block">
          <ul class="menu menu-horizontal gap-1 px-1">
            <li>
              <NuxtLink
                to="/dashboard"
                :class="[
                  isActive('/dashboard')
                    ? 'bg-primary text-primary-content'
                    : '',
                ]"
              >
                Dashboard
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/dashboard/mi-quiniela"
                :class="[
                  isActive('/dashboard/mi-quiniela')
                    ? 'bg-primary text-primary-content'
                    : '',
                ]"
              >
                Mi quiniela
              </NuxtLink>
            </li>
            <li class="relative">
              <details ref="desktopPartidosDetails">
                <summary
                  :class="[
                    isPartidosActive
                      ? 'bg-primary text-primary-content'
                      : 'text-base-content',
                  ]"
                >
                  Partidos
                </summary>
                <ul
                  class="bg-base-100 absolute left-0 top-full z-50 mt-2 min-w-44 rounded-box border border-base-300 p-2 shadow-xl"
                >
                  <li>
                    <NuxtLink
                      to="/dashboard/grupos"
                      :class="[isActive('/dashboard/grupos') ? 'active' : '']"
                      @click="closePartidosMenus"
                    >
                      Grupos
                    </NuxtLink>
                  </li>
                  <li>
                    <NuxtLink
                      to="/dashboard/eliminatorias"
                      :class="[
                        isActive('/dashboard/eliminatorias') ? 'active' : '',
                      ]"
                      @click="closePartidosMenus"
                    >
                      Eliminatorias
                    </NuxtLink>
                  </li>
                </ul>
              </details>
            </li>
            <li>
              <NuxtLink
                to="/dashboard/posiciones"
                :class="[
                  isActive('/dashboard/posiciones')
                    ? 'bg-primary text-primary-content'
                    : '',
                ]"
              >
                Ranking usuarios
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/dashboard/estadisticas"
                :class="[
                  isActive('/dashboard/estadisticas')
                    ? 'bg-primary text-primary-content'
                    : '',
                ]"
              >
                Estadisticas
              </NuxtLink>
            </li>
            <li v-if="canAccessAdmin">
              <NuxtLink
                to="/admin"
                :class="[
                  isActive('/admin') ? 'bg-primary text-primary-content' : '',
                ]"
              >
                Admin
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div class="flex items-center gap-2">
          <div v-if="user" class="dropdown dropdown-start lg:hidden">
            <button
              tabindex="0"
              role="button"
              class="btn btn-ghost btn-sm"
              aria-label="Abrir menu de navegacion"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="h-5 w-5 stroke-current"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <ul
              tabindex="0"
              class="menu dropdown-content left-0 right-auto z-40 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
            >
              <li>
                <NuxtLink to="/dashboard">Dashboard</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/dashboard/mi-quiniela">Mi quiniela</NuxtLink>
              </li>
              <li>
                <details ref="mobilePartidosDetails">
                  <summary>Partidos</summary>
                  <ul class="bg-base-100 rounded-t-none p-2">
                    <li>
                      <NuxtLink
                        to="/dashboard/grupos"
                        @click="closePartidosMenus"
                        >Grupos</NuxtLink
                      >
                    </li>
                    <li>
                      <NuxtLink
                        to="/dashboard/eliminatorias"
                        @click="closePartidosMenus"
                        >Eliminatorias</NuxtLink
                      >
                    </li>
                  </ul>
                </details>
              </li>
              <li>
                <NuxtLink to="/dashboard/posiciones">Ranking usuarios</NuxtLink>
              </li>
              <li>
                <NuxtLink to="/dashboard/estadisticas">Estadisticas</NuxtLink>
              </li>
              <li v-if="canAccessAdmin">
                <NuxtLink to="/admin">Admin</NuxtLink>
              </li>
            </ul>
          </div>

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

      <div v-if="user" class="mx-auto w-full max-w-7xl px-4 pb-2 sm:px-6">
        <div
          class="flex flex-wrap items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-xs"
        >
          <span class="text-base-content/70">Sesion:</span>
          <strong class="text-base-content">{{ sessionUserName }}</strong>

          <span class="hidden h-4 w-px bg-base-300/70 sm:inline-block"></span>

          <span class="text-base-content/70">Quiniela:</span>
          <img
            v-if="quiniela?.logo_url"
            :src="quiniela.logo_url"
            :alt="`Logo de ${quiniela.name}`"
            class="h-7 w-7 rounded-lg border border-base-300 bg-base-100 object-contain"
          />
          <strong class="text-base-content max-w-52 truncate">
            {{ quiniela?.name || "Sin quiniela" }}
          </strong>

          <span
            class="badge badge-xs"
            :class="quiniela ? 'badge-primary' : 'badge-warning'"
          >
            {{ quiniela ? "Activa" : "Sin quiniela" }}
          </span>

          <div
            class="ml-auto flex min-w-60 flex-1 items-center gap-2 sm:flex-initial"
          >
            <label
              class="text-base-content/70 whitespace-nowrap"
              for="header-quiniela-selector"
            >
              Cambiar
            </label>
            <select
              id="header-quiniela-selector"
              class="select select-bordered select-xs h-8 min-h-8 w-full sm:w-64"
              :value="activeQuinielaId || ''"
              :disabled="switchingQuiniela || myQuinielas.length === 0"
              @change="onActiveQuinielaChange"
            >
              <option value="" disabled>
                {{
                  myQuinielas.length === 0
                    ? "Sin quinielas disponibles"
                    : "Selecciona quiniela"
                }}
              </option>
              <option
                v-for="entry in myQuinielas"
                :key="entry.quiniela_id"
                :value="entry.quiniela_id"
              >
                {{ entry.quiniela?.name || "Quiniela" }}
              </option>
            </select>
            <NuxtLink to="/ingresar" class="btn btn-ghost btn-xs">
              Gestionar
            </NuxtLink>
          </div>

          <span
            v-if="switchingQuiniela"
            class="text-base-content/70 text-[11px]"
          >
            Cambiando...
          </span>
        </div>
      </div>

      <div v-if="user && tickerMetrics.length" class="odds-strip">
        <div class="odds-track">
          <div
            v-for="segment in 2"
            :key="`segment-${segment}`"
            class="odds-segment"
          >
            <span
              v-for="(item, index) in tickerMetrics"
              :key="`${segment}-${item.label}-${index}`"
              class="odds-chip"
              :class="metricChipClass(item)"
            >
              <span class="odds-market">
                <span class="odds-icon" aria-hidden="true">{{
                  item.icon
                }}</span>
                {{ item.label }}
              </span>
              <strong class="odds-price" :class="metricPriceClass(item)">{{
                item.value
              }}</strong>
            </span>
          </div>
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
