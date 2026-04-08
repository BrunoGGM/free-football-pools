<script setup lang="ts">
interface KpiItem {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}

const props = defineProps<{
  items: KpiItem[];
}>();

const toneClass = (tone: KpiItem["tone"]) => {
  if (tone === "success") {
    return "border-success/35 bg-success/10";
  }

  if (tone === "warning") {
    return "border-warning/35 bg-warning/10";
  }

  if (tone === "danger") {
    return "border-error/35 bg-error/10";
  }

  if (tone === "info") {
    return "border-info/35 bg-info/10";
  }

  return "border-base-300 bg-base-100/70";
};
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <article
      v-for="item in props.items"
      :key="item.label"
      class="rounded-2xl border p-4"
      :class="toneClass(item.tone)"
    >
      <p class="text-base-content/70 text-[11px] uppercase tracking-[0.12em]">
        {{ item.label }}
      </p>
      <p class="text-base-content mt-1 text-2xl font-bold">
        {{ item.value }}
      </p>
      <p v-if="item.hint" class="text-base-content/70 mt-1 text-xs">
        {{ item.hint }}
      </p>
    </article>
  </div>
</template>
