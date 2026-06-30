<script setup lang="ts">
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Radar } from "vue-chartjs";
import { computed } from "vue";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const props = defineProps<{
  title: string;
  labels: string[];
  values: number[];
  color?: string;
}>();

const chartData = computed(() => {
  return {
    labels: props.labels,
    datasets: [
      {
        label: props.title,
        backgroundColor: props.color
          ? `${props.color}33`
          : "rgba(34, 197, 94, 0.2)",
        borderColor: props.color || "#22c55e",
        pointBackgroundColor: props.color || "#22c55e",
        pointBorderColor: "#fff",
        pointHoverBackgroundColor: "#fff",
        pointHoverBorderColor: props.color || "#22c55e",
        data: props.values,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      angleLines: {
        color: "rgba(120, 120, 120, 0.2)",
      },
      grid: {
        color: "rgba(120, 120, 120, 0.2)",
      },
      pointLabels: {
        color: "#9ca3af",
        font: {
          size: 11,
          family: "'Inter', sans-serif",
        },
      },
      ticks: {
        display: false,
        min: 0,
        max: 100,
        stepSize: 20,
      },
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      titleColor: "#f8fafc",
      bodyColor: "#f8fafc",
      borderColor: "rgba(255, 255, 255, 0.1)",
      borderWidth: 1,
      padding: 10,
      displayColors: false,
      callbacks: {
        label: (context: any) => `${context.parsed.r}% de acierto`,
      },
    },
  },
};
</script>

<template>
  <article class="rounded-2xl border border-base-300 bg-base-100/70 p-4">
    <h3
      class="text-base-content text-sm font-semibold uppercase tracking-[0.12em]"
    >
      {{ title }}
    </h3>
    <div class="relative mt-4 h-64 w-full">
      <Radar :data="chartData" :options="chartOptions" />
    </div>
  </article>
</template>
