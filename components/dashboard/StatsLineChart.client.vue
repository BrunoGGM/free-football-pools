<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "vue-chartjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface LineDatasetInput {
  label: string;
  values: number[];
  color: string;
  fill?: boolean;
}

const props = defineProps<{
  title: string;
  labels: string[];
  datasets: LineDatasetInput[];
}>();

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((dataset) => ({
    label: dataset.label,
    data: dataset.values,
    borderColor: dataset.color,
    backgroundColor: `${dataset.color}33`,
    pointRadius: 3,
    pointHoverRadius: 4,
    tension: 0.35,
    borderWidth: 2,
    fill: dataset.fill ?? false,
  })),
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
      labels: {
        boxWidth: 12,
      },
    },
    title: {
      display: false,
      text: props.title,
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
    },
  },
  interaction: {
    mode: "index" as const,
    intersect: false,
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
      grid: {
        color: "rgba(148, 163, 184, 0.15)",
      },
    },
    x: {
      grid: {
        color: "rgba(148, 163, 184, 0.08)",
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
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </article>
</template>
