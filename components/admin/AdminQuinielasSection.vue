<script setup lang="ts">
defineProps<{
  isGlobalAdmin: boolean;
  globalLoading: boolean;
  globalError: string | null;
  globalMessage: string | null;
  globalStats: {
    totals: {
      users: number;
      globalAdmins: number;
      quinielas: number;
      members: number;
      matches: number;
      predictions: number;
    };
  } | null;
  managedQuinielas: Array<{
    id: string;
    name: string;
    description: string | null;
    access_code: string;
    start_date: string;
    admin_id: string;
    admin_username: string;
  }>;
  quinielaForm: {
    id: string;
    name: string;
    description: string;
    access_code: string;
    start_date: string;
    end_date: string;
    admin_id: string;
  };
  savingQuiniela: boolean;
  deletingQuinielaId: string | null;
}>();

const emit = defineEmits<{
  randomAccessCode: [];
  saveQuiniela: [];
  resetQuinielaForm: [];
  editQuiniela: [item: any];
  deleteQuiniela: [id: string];
}>();
</script>

<template>
  <article v-if="isGlobalAdmin" class="pitch-panel rounded-2xl p-5">
    <h2 class="text-xl text-white">Dashboard global</h2>
    <p class="mt-2 text-sm text-(--text-muted)">
      Como global admin puedes ver metricas totales y gestionar quinielas de
      toda la plataforma.
    </p>

    <p v-if="globalLoading" class="mt-4 text-sm text-(--text-muted)">
      Cargando dashboard global...
    </p>

    <p
      v-else-if="globalError"
      class="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {{ globalError }}
    </p>

    <template v-else-if="globalStats">
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Usuarios
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.users }}
          </p>
        </div>
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Global admins
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.globalAdmins }}
          </p>
        </div>
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Quinielas
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.quinielas }}
          </p>
        </div>
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Miembros
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.members }}
          </p>
        </div>
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Partidos
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.matches }}
          </p>
        </div>
        <div class="rounded-xl border border-white/10 bg-black/35 p-4">
          <p class="text-xs uppercase tracking-[0.12em] text-(--text-muted)">
            Predicciones
          </p>
          <p class="mt-1 text-2xl font-semibold text-white">
            {{ globalStats.totals.predictions }}
          </p>
        </div>
      </div>

      <div class="mt-6 rounded-xl border border-white/10 bg-black/25 p-4">
        <h3 class="text-lg text-emerald-200">
          {{ quinielaForm.id ? "Editar quiniela" : "Crear quiniela" }}
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Nombre
            </label>
            <input
              v-model="quinielaForm.name"
              class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
              placeholder="Quiniela principal"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Access code
            </label>
            <div class="flex gap-2">
              <input
                v-model="quinielaForm.access_code"
                maxlength="12"
                class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 uppercase text-slate-100 outline-none focus:border-emerald-400"
                placeholder="ABC123"
              />
              <button
                class="rounded-xl border border-white/15 px-3 text-xs text-slate-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
                @click="emit('randomAccessCode')"
              >
                Generar
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Admin user id
            </label>
            <input
              v-model="quinielaForm.admin_id"
              class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
              placeholder="uuid del admin"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Inicio
            </label>
            <input
              v-model="quinielaForm.start_date"
              type="datetime-local"
              class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Fin (opcional)
            </label>
            <input
              v-model="quinielaForm.end_date"
              type="datetime-local"
              class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
            >
              Descripcion
            </label>
            <textarea
              v-model="quinielaForm.description"
              rows="3"
              class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
              placeholder="Descripcion de la quiniela"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="rounded-full border border-emerald-300/45 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="savingQuiniela"
            @click="emit('saveQuiniela')"
          >
            {{
              savingQuiniela
                ? "Guardando..."
                : quinielaForm.id
                  ? "Guardar cambios"
                  : "Crear quiniela"
            }}
          </button>
          <button
            v-if="quinielaForm.id"
            class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-white/35"
            @click="emit('resetQuinielaForm')"
          >
            Cancelar edicion
          </button>
        </div>

        <p
          v-if="globalMessage"
          class="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
        >
          {{ globalMessage }}
        </p>

        <p
          v-if="globalError"
          class="mt-3 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {{ globalError }}
        </p>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-white/8">
        <table class="min-w-full text-sm">
          <thead
            class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            <tr>
              <th class="px-4 py-3">Quiniela</th>
              <th class="px-4 py-3">Admin</th>
              <th class="px-4 py-3">Codigo</th>
              <th class="px-4 py-3">Inicio</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in managedQuinielas"
              :key="item.id"
              class="border-t border-white/8"
            >
              <td class="px-4 py-3">
                <p class="font-semibold text-slate-100">{{ item.name }}</p>
                <p class="text-xs text-(--text-muted)">
                  {{ item.description || "Sin descripcion" }}
                </p>
              </td>
              <td class="px-4 py-3">
                <p class="text-slate-100">{{ item.admin_username }}</p>
                <p class="text-xs text-(--text-muted)">{{ item.admin_id }}</p>
              </td>
              <td class="px-4 py-3 uppercase">{{ item.access_code }}</td>
              <td class="px-4 py-3 text-(--text-muted)">
                {{ new Date(item.start_date).toLocaleString("es-MX") }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    class="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
                    @click="emit('editQuiniela', item)"
                  >
                    Editar
                  </button>
                  <button
                    class="rounded-full border border-red-300/25 px-3 py-1 text-xs text-red-100 transition hover:border-red-200 hover:text-red-50 disabled:opacity-55"
                    :disabled="deletingQuinielaId === item.id"
                    @click="emit('deleteQuiniela', item.id)"
                  >
                    {{
                      deletingQuinielaId === item.id
                        ? "Eliminando..."
                        : "Borrar"
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </article>

  <article
    v-else
    class="pitch-panel rounded-2xl border border-amber-300/20 bg-amber-500/5 p-5"
  >
    <h2 class="text-xl text-amber-100">Acceso admin local</h2>
    <p class="mt-2 text-sm text-amber-100/85">
      Tu acceso actual permite administrar la quiniela activa. El dashboard
      global solo aparece para usuarios con flag is_global_admin.
    </p>
  </article>
</template>
