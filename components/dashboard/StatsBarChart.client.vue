<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { Bar } from "vue-chartjs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const props = defineProps<{
  title: string;
  labels: string[];
  values: number[];
  color?: string;
}>();

const barColor = computed(() => props.color || "#f59e0b");

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: "Puntos",
      data: props.values,
      backgroundColor: `${barColor.value}cc`,
      borderColor: barColor.value,
      borderWidth: 1,
      borderRadius: 8,
      maxBarThickness: 36,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      intersect: false,
    },
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
        display: false,
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
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </article>
</template>
