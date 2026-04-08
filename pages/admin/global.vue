<script setup lang="ts">
definePageMeta({
  middleware: ["auth", "admin", "global-admin"],
});
</script>

<template>
  <AdminWorkspacePanel mode="global" />
</template>
