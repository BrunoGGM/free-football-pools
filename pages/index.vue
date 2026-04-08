<script setup lang="ts">
const user = useSupabaseUser();

const ctaPrimary = computed(() =>
  user.value ? "/dashboard" : "/auth?mode=login",
);
const ctaSecondary = computed(() =>
  user.value ? "/ingresar" : "/auth?mode=register",
);

const highlights = [
  {
    icon: "⚡",
    title: "Predicciones por fase",
    text: "Carga tus marcadores para grupos y eliminatorias desde un mismo panel.",
  },
  {
    icon: "📈",
    title: "Ranking en tiempo real",
    text: "Cada gol actualizado recalcula puntos y mueve la tabla al instante.",
  },
  {
    icon: "🔒",
    title: "Salas privadas",
    text: "Comparte solo con tu grupo usando codigo de acceso por quiniela.",
  },
];

const epicMomentTemplates = [
  {
    title: "Noches de estadio",
    subtitle: "Atmosfera de final",
  },
  {
    title: "Gol al 90'",
    subtitle: "La tabla explota en vivo",
  },
  {
    title: "Domina eliminatorias",
    subtitle: "Predice cruces y campeon",
  },
];

const heroPosterPool = [
  "https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1920",
  "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1920",
  "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1920",
  "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1080&w=1920",
];

const epicImagePool = [
  "https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
  "https://images.pexels.com/photos/3621104/pexels-photo-3621104.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
  "https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
  "https://images.pexels.com/photos/1884574/pexels-photo-1884574.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
  "https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
  "https://images.pexels.com/photos/1618200/pexels-photo-1618200.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=1600",
];

const pickRandom = <T,>(items: T[]) => {
  return items[Math.floor(Math.random() * items.length)] as T;
};

const shuffleItems = <T,>(items: T[]) => {
  const cloned = [...items];

  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = cloned[i] as T;

    cloned[i] = cloned[j] as T;
    cloned[j] = current;
  }

  return cloned;
};

const landingVisuals = useState("landing-home-visuals", () => {
  const shuffledImages = shuffleItems(epicImagePool);

  return {
    poster: pickRandom(heroPosterPool),
    moments: epicMomentTemplates.map((moment, index) => ({
      ...moment,
      image: shuffledImages[index % shuffledImages.length],
    })),
  };
});

const heroPoster = computed(() => landingVisuals.value.poster);
const epicMoments = computed(() => landingVisuals.value.moments);
</script>

<template>
  <section class="landing-wow grid gap-6">
    <div
      class="hero-stage pitch-panel neon-border card relative isolate min-h-[68vh] overflow-hidden border border-base-300 bg-base-200/50 p-0 shadow-2xl"
    >
      <video
        class="hero-video"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        :poster="heroPoster"
      >
        <source
          src="https://cdn.coverr.co/videos/coverr-aerial-view-of-a-large-stadium-1579/1080p.mp4"
          type="video/mp4"
        />
      </video>
      <div class="hero-fallback" />
      <div class="hero-grid-pattern" />
      <div class="hero-light-ribbons" />
      <div class="hero-glow hero-glow-a" />
      <div class="hero-glow hero-glow-b" />

      <div
        class="relative z-10 grid gap-8 p-6 sm:p-8 lg:min-h-[68vh] lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:p-10"
      >
        <div class="hero-copy space-y-5">
          <span
            class="badge badge-warning badge-outline wow-chip px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em]"
          >
            Mundial 2026 en modo epico
          </span>

          <h1 class="hero-title text-base-content text-4xl leading-tight sm:text-6xl">
            Tu quiniela,
            <span class="hero-title-accent">como una final mundial</span>
          </h1>

          <p class="hero-subtitle text-base-content/85 max-w-2xl text-base sm:text-lg">
            Arma tu sala, pronostica cada partido y vive el ranking en tiempo
            real con una experiencia visual intensa y competitiva.
          </p>

          <div class="mt-7 flex flex-wrap gap-3">
            <NuxtLink :to="ctaPrimary" class="btn btn-primary btn-lg shadow-lg">
              {{ user ? "Ir al dashboard" : "Iniciar sesion" }}
            </NuxtLink>
            <NuxtLink :to="ctaSecondary" class="btn btn-outline btn-lg">
              {{ user ? "Ingresar con codigo" : "Registrarse" }}
            </NuxtLink>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <article
              v-for="item in highlights"
              :key="item.title"
              class="wow-kpi card border border-base-300 bg-base-100/80 p-4 backdrop-blur"
            >
              <p class="text-xl leading-none">{{ item.icon }}</p>
              <h2 class="text-primary mt-2 text-base">{{ item.title }}</h2>
              <p class="text-base-content/70 mt-1 text-xs">{{ item.text }}</p>
            </article>
          </div>
        </div>

        <div class="hidden lg:block">
          <div class="hero-scoreboard card border border-base-300 bg-base-100/72 p-5 backdrop-blur-lg">
            <p class="text-warning text-xs font-semibold uppercase tracking-[0.24em]">
              Simulacion en vivo
            </p>
            <h2 class="text-base-content mt-2 text-3xl">Ritmo de estadio</h2>
            <p class="text-base-content/75 mt-2 text-sm">
              Recibe cada cambio de marcador como un golpe directo en la tabla.
            </p>

            <div class="mt-5 grid gap-2 text-sm">
              <div class="scoreline-item">
                <span class="scoreline-team">MEX</span>
                <span class="scoreline-score">2 - 1</span>
                <span class="scoreline-team text-right">BRA</span>
              </div>
              <div class="scoreline-item">
                <span class="scoreline-team">ESP</span>
                <span class="scoreline-score">3 - 3</span>
                <span class="scoreline-team text-right">ARG</span>
              </div>
              <div class="scoreline-item">
                <span class="scoreline-team">FRA</span>
                <span class="scoreline-score">1 - 0</span>
                <span class="scoreline-team text-right">POR</span>
              </div>
            </div>

            <div class="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-3">
              <p class="text-warning text-xs font-semibold uppercase tracking-[0.14em]">
                Bonus activo
              </p>
              <p class="text-base-content mt-1 text-sm">
                +10 si aciertas campeon predicho antes del pitazo inicial.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div class="grid gap-4 sm:grid-cols-2">
        <article
          v-for="(moment, idx) in epicMoments"
          :key="moment.title"
          class="epic-photo-card card group overflow-hidden border border-base-300 bg-base-100/70"
        >
          <img
            :src="moment.image"
            :alt="moment.title"
            loading="lazy"
            class="h-56 w-full object-cover sm:h-64"
          />
          <div class="epic-photo-overlay" />
          <div class="epic-photo-copy">
            <p class="text-warning text-xs font-semibold uppercase tracking-[0.2em]">
              Momento {{ idx + 1 }}
            </p>
            <h3 class="text-base-content mt-1 text-2xl">{{ moment.title }}</h3>
            <p class="text-base-content/80 mt-1 text-sm">{{ moment.subtitle }}</p>
          </div>
        </article>
      </div>

      <aside
        class="pitch-panel card overflow-hidden border border-base-300 bg-base-200/80 p-6 shadow-xl sm:p-7"
      >
        <p class="text-warning text-xs font-semibold uppercase tracking-[0.2em]">
          Puntos oficiales
        </p>
        <h2 class="text-base-content mt-2 text-2xl">Reglamento rapido</h2>

        <ul class="text-base-content mt-5 space-y-3 text-sm">
          <li class="card border border-base-300 bg-base-100/80 p-3">
            <p class="text-primary font-semibold">1 punto</p>
            <p class="text-base-content/70">
              Acertar resultado (local, empate o visita).
            </p>
          </li>
          <li class="card border border-base-300 bg-base-100/80 p-3">
            <p class="text-primary font-semibold">3 puntos</p>
            <p class="text-base-content/70">
              Acertar marcador exacto del partido.
            </p>
          </li>
          <li class="card border border-base-300 bg-base-100/80 p-3">
            <p class="text-warning font-semibold">10 puntos bonus</p>
            <p class="text-base-content/70">
              Acertar campeon predicho antes del inicio del torneo.
            </p>
          </li>
        </ul>

        <NuxtLink
          to="/ingresar"
          class="btn btn-outline btn-primary btn-sm mt-6 inline-flex"
        >
          Ya tienes codigo de sala
        </NuxtLink>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.landing-wow {
  perspective: 1200px;
}

.hero-stage {
  transform-style: preserve-3d;
}

.hero-video,
.hero-fallback,
.hero-grid-pattern,
.hero-light-ribbons,
.hero-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-video {
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.6;
  filter: saturate(1.12) contrast(1.06) brightness(0.9);
  transform-origin: 50% 50%;
  animation: hero-video-drift 24s ease-in-out infinite alternate;
}

.hero-fallback {
  z-index: 1;
  background:
    radial-gradient(circle at 15% 15%, rgba(255, 179, 64, 0.31), transparent 45%),
    radial-gradient(circle at 88% 32%, rgba(72, 160, 255, 0.24), transparent 40%),
    linear-gradient(140deg, rgba(10, 16, 35, 0.66), rgba(14, 23, 44, 0.74));
}

.hero-grid-pattern {
  z-index: 2;
  background:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: linear-gradient(to top, #000, transparent 78%);
  opacity: 0.28;
}

.hero-light-ribbons {
  z-index: 3;
  overflow: hidden;
}

.hero-light-ribbons::before,
.hero-light-ribbons::after {
  content: "";
  position: absolute;
  inset: -10% -25%;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(2px);
}

.hero-light-ribbons::before {
  background: linear-gradient(
    112deg,
    transparent 34%,
    rgba(255, 212, 133, 0.18) 49%,
    transparent 64%
  );
  animation: hero-light-sweep-a 13s ease-in-out infinite;
}

.hero-light-ribbons::after {
  background: linear-gradient(
    102deg,
    transparent 30%,
    rgba(117, 215, 255, 0.2) 46%,
    transparent 62%
  );
  animation: hero-light-sweep-b 17s ease-in-out infinite;
}

.hero-glow {
  z-index: 4;
  mix-blend-mode: screen;
}

.hero-glow-a {
  background: radial-gradient(circle at 20% 28%, rgba(255, 188, 73, 0.38), transparent 32%);
  animation: glow-drift-a 9s ease-in-out infinite alternate;
}

.hero-glow-b {
  background: radial-gradient(circle at 82% 18%, rgba(46, 205, 255, 0.31), transparent 34%);
  animation: glow-drift-b 11s ease-in-out infinite alternate;
}

.hero-copy {
  animation: hero-rise 620ms ease-out both;
}

.wow-chip {
  box-shadow:
    0 0 0 1px rgba(255, 180, 86, 0.32),
    0 0 22px rgba(255, 180, 86, 0.35);
}

.hero-title {
  text-wrap: balance;
  text-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.hero-title-accent {
  display: inline-block;
  background: linear-gradient(120deg, #ffe081 0%, #ff9f4d 45%, #4dd4ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: accent-shimmer 3s linear infinite;
}

.hero-subtitle {
  text-wrap: pretty;
}

.wow-kpi {
  animation: card-pop 520ms ease-out both;
}

.wow-kpi:nth-child(1) {
  animation-delay: 90ms;
}

.wow-kpi:nth-child(2) {
  animation-delay: 150ms;
}

.wow-kpi:nth-child(3) {
  animation-delay: 210ms;
}

.hero-scoreboard {
  position: relative;
  overflow: hidden;
  animation: float-in 660ms ease-out 110ms both;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 24px 46px rgba(0, 0, 0, 0.32);
}

.hero-scoreboard::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.2) 48%, transparent 64%);
  transform: translateX(-125%);
  animation: panel-shine 3.8s ease-in-out infinite;
  pointer-events: none;
}

.scoreline-item {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.7rem;
  align-items: center;
  border: 1px solid color-mix(in oklab, var(--color-base-content) 16%, transparent);
  border-radius: 0.85rem;
  padding: 0.5rem 0.65rem;
  background: color-mix(in oklab, var(--color-base-100) 84%, transparent);
}

.scoreline-team {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}

.scoreline-score {
  color: color-mix(in oklab, var(--color-warning) 88%, #fff);
  font-weight: 700;
  font-size: 0.95rem;
  text-shadow: 0 0 10px color-mix(in oklab, var(--color-warning) 38%, transparent);
}

.epic-photo-card {
  position: relative;
  min-height: 15rem;
  isolation: isolate;
  transform: translateZ(0);
  animation: photo-rise 620ms ease-out both;
}

.epic-photo-card:nth-child(1) {
  animation-delay: 80ms;
}

.epic-photo-card:nth-child(2) {
  animation-delay: 150ms;
}

.epic-photo-card:nth-child(3) {
  animation-delay: 220ms;
}

.epic-photo-card img {
  transition: transform 600ms ease, filter 600ms ease;
}

.epic-photo-card:hover img {
  transform: scale(1.08);
  filter: saturate(1.14);
}

.epic-photo-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to top, rgba(6, 10, 24, 0.82), rgba(6, 10, 24, 0.18) 58%, transparent);
}

.epic-photo-copy {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 1rem;
  z-index: 2;
}

@keyframes hero-rise {
  0% {
    opacity: 0;
    transform: translateY(18px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes card-pop {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes photo-rise {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float-in {
  0% {
    opacity: 0;
    transform: translateY(12px) rotateX(7deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}

@keyframes panel-shine {
  0% {
    transform: translateX(-125%);
  }
  40% {
    transform: translateX(125%);
  }
  100% {
    transform: translateX(125%);
  }
}

@keyframes accent-shimmer {
  0% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.16);
  }
  100% {
    filter: brightness(1);
  }
}

@keyframes glow-drift-a {
  from {
    transform: translate(-3%, 0%);
  }
  to {
    transform: translate(2%, 4%);
  }
}

@keyframes glow-drift-b {
  from {
    transform: translate(2%, -3%);
  }
  to {
    transform: translate(-2%, 3%);
  }
}

@keyframes hero-video-drift {
  from {
    transform: scale(1.03) translate3d(-1.2%, 0%, 0);
  }
  to {
    transform: scale(1.1) translate3d(1.2%, -1%, 0);
  }
}

@keyframes hero-light-sweep-a {
  0% {
    transform: translate3d(-18%, 0, 0) rotate(-2deg);
    opacity: 0.2;
  }
  50% {
    opacity: 0.44;
  }
  100% {
    transform: translate3d(14%, -2%, 0) rotate(2deg);
    opacity: 0.16;
  }
}

@keyframes hero-light-sweep-b {
  0% {
    transform: translate3d(14%, 1%, 0) rotate(1.5deg);
    opacity: 0.16;
  }
  55% {
    opacity: 0.4;
  }
  100% {
    transform: translate3d(-14%, -2%, 0) rotate(-1.5deg);
    opacity: 0.2;
  }
}

@media (max-width: 1023px) {
  .hero-video {
    opacity: 0.46;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-copy,
  .wow-kpi,
  .hero-scoreboard,
  .hero-scoreboard::after,
  .epic-photo-card,
  .hero-title-accent,
  .hero-light-ribbons::before,
  .hero-light-ribbons::after,
  .hero-glow-a,
  .hero-glow-b,
  .hero-video,
  .epic-photo-card img {
    animation: none !important;
    transition: none !important;
  }
}
</style>
