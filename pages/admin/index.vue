<script setup lang="ts">
definePageMeta({
  middleware: ["auth", "admin"],
});

const client = useSupabaseClient<any>();
const user = useSupabaseUser();
const redirecting = ref(true);

onMounted(async () => {
  if (!user.value) {
    await navigateTo("/auth", { replace: true });
    return;
  }

  const { data: profile } = await client
    .from("profiles")
    .select("is_global_admin")
    .eq("id", user.value.id)
    .maybeSingle();

  const target = profile?.is_global_admin ? "/admin/global" : "/admin/local";
  await navigateTo(target, { replace: true });
  redirecting.value = false;
});
</script>

<template>
  <section class="space-y-4">
    <p class="text-primary text-xs uppercase tracking-[0.18em]">Admin</p>
    <h1 class="text-base-content text-2xl">Preparando tu panel...</h1>
    <p v-if="redirecting" class="text-base-content/70 text-sm">
      Detectando tu rol para abrir la vista correspondiente.
    </p>
  </section>
</template>
