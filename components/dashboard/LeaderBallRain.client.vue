<script setup lang="ts">
interface BallItem {
  id: string;
  left: number;
  size: number;
  durationMs: number;
  delayMs: number;
  swayPx: number;
  rotationDeg: number;
  popped: boolean;
  kickXPx: number;
  kickYPx: number;
}

const props = withDefaults(
  defineProps<{
    visible: boolean;
    seed?: number;
  }>(),
  {
    seed: 0,
  },
);

const isActive = ref(false);
const balls = ref<BallItem[]>([]);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let popTimers: ReturnType<typeof setTimeout>[] = [];

const clearTimers = () => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  for (const timer of popTimers) {
    clearTimeout(timer);
  }

  popTimers = [];
};

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const createBallBatch = () => {
  const total = 26;

  balls.value = Array.from({ length: total }, (_, index) => ({
    id: `leader-ball-${props.seed}-${index}-${Math.round(Math.random() * 1e6)}`,
    left: randomBetween(3, 97),
    size: randomBetween(28, 48),
    durationMs: randomBetween(3400, 6200),
    delayMs: randomBetween(0, 1800),
    swayPx: randomBetween(-120, 120),
    rotationDeg: randomBetween(-540, 540),
    popped: false,
    kickXPx: 0,
    kickYPx: 0,
  }));
};

const stopRain = () => {
  clearTimers();
  isActive.value = false;
  balls.value = [];
};

const launchRain = () => {
  clearTimers();
  createBallBatch();
  isActive.value = true;

  hideTimer = setTimeout(() => {
    stopRain();
  }, 6800);
};

const popBall = (ball: BallItem) => {
  if (!isActive.value || ball.popped) {
    return;
  }

  ball.popped = true;
  ball.kickXPx = randomBetween(-130, 130);
  ball.kickYPx = randomBetween(-180, -70);

  const timer = setTimeout(() => {
    balls.value = balls.value.filter((item) => item.id !== ball.id);
  }, 260);

  popTimers.push(timer);
};

watch(
  () => [props.visible, props.seed] as const,
  ([visible]) => {
    if (visible) {
      launchRain();
      return;
    }

    stopRain();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearTimers();
});
</script>

<template>
  <div v-if="isActive" class="leader-ball-rain" aria-hidden="true">
    <div
      v-for="ball in balls"
      :key="ball.id"
      class="leader-ball"
      :class="{ 'leader-ball--popped': ball.popped }"
      :style="{
        left: `${ball.left}%`,
        fontSize: `${ball.size}px`,
        '--fall-duration': `${ball.durationMs}ms`,
        '--fall-delay': `${ball.delayMs}ms`,
        '--fall-sway': `${ball.swayPx}px`,
        '--fall-rotation': `${ball.rotationDeg}deg`,
        '--kick-x': `${ball.kickXPx}px`,
        '--kick-y': `${ball.kickYPx}px`,
      }"
      @pointerdown.stop.prevent="popBall(ball)"
    >
      ⚽
    </div>
  </div>
</template>

<style scoped>
.leader-ball-rain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 70;
}

.leader-ball {
  position: absolute;
  top: -14vh;
  transform: translate3d(0, 0, 0) rotate(0deg);
  will-change: transform, opacity;
  user-select: none;
  cursor: pointer;
  pointer-events: auto;
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 0.25));
  animation-name: ball-fall;
  animation-duration: var(--fall-duration);
  animation-delay: var(--fall-delay);
  animation-timing-function: cubic-bezier(0.24, 0.12, 0.21, 1);
  animation-fill-mode: forwards;
}

.leader-ball--popped {
  animation: none;
  opacity: 0;
  transform: translate3d(var(--kick-x), var(--kick-y), 0) scale(1.35)
    rotate(26deg);
  transition:
    transform 220ms ease,
    opacity 220ms ease;
}

@keyframes ball-fall {
  0% {
    transform: translate3d(0, -8vh, 0) rotate(0deg);
  }
  100% {
    transform: translate3d(var(--fall-sway), 120vh, 0)
      rotate(var(--fall-rotation));
  }
}
</style>
