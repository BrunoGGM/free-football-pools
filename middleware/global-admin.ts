export default defineNuxtRouteMiddleware(async () => {
  const user = useSupabaseUser();

  if (!user.value) {
    return navigateTo("/auth");
  }

  const client = useSupabaseClient<any>();
  const { data: profile, error } = await client
    .from("profiles")
    .select("is_global_admin")
    .eq("id", user.value.id)
    .maybeSingle();

  if (error || !profile?.is_global_admin) {
    return navigateTo("/admin/local");
  }
});