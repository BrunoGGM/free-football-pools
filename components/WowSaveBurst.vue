<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    subtitle?: string;
  }>(),
  {
    title: "Apuesta cerrada",
    subtitle: "Pronostico confirmado",
  },
);
</script>

<template>
  <Transition name="wow-burst">
    <div
      v-if="props.visible"
      class="wow-save-burst rounded-xl border border-success/40 bg-success/10 px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-3">
        <svg
          class="wow-save-icon"
          width="42"
          height="42"
          viewBox="0 0 42 42"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="21" cy="21" r="18" class="wow-save-ring" />
          <path
            d="M13.5 21.5L18.5 26.5L28.5 16"
            class="wow-save-check"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M21 4.5V9" class="wow-save-ray delay-1" />
          <path d="M21 33V37.5" class="wow-save-ray delay-2" />
          <path d="M4.5 21H9" class="wow-save-ray delay-3" />
          <path d="M33 21H37.5" class="wow-save-ray delay-4" />
        </svg>

        <div>
          <p
            class="text-success-content text-sm font-semibold uppercase tracking-[0.12em]"
          >
            {{ props.title }}
          </p>
          <p class="text-success-content/80 text-xs">
            {{ props.subtitle }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>
