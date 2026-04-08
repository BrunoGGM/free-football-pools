<script setup lang="ts">
import { ArcElement, Chart as ChartJS, Legend, Title, Tooltip } from "chart.js";
import { Doughnut } from "vue-chartjs";

ChartJS.register(ArcElement, Title, Tooltip, Legend);

const props = defineProps<{
  title: string;
  labels: string[];
  values: number[];
  colors: string[];
}>();

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      data: props.values,
      backgroundColor: props.colors,
      borderColor: "rgba(15, 23, 42, 0.35)",
      borderWidth: 1,
      hoverOffset: 8,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: "62%",
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: {
        boxWidth: 12,
      },
    },
  },
}));
</script>

<template>
  <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
    <h3
      class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
    >
      {{ title }}
    </h3>
    <div class="mt-3 h-64">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </article>
</template>
