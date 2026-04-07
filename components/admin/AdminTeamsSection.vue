<script setup lang="ts">
defineProps<{
  teamProfiles: Array<{
    id: string;
    team_key: string;
    name: string;
    code: string | null;
    country: string | null;
    logo_url: string | null;
    source_provider: string;
  }>;
  teamsTotal: number;
  teamsLoading: boolean;
  teamsError: string | null;
  teamsMessage: string | null;
  teamsSearch: string;
  savingTeamProfile: boolean;
  deletingTeamProfileId: string | null;
  forceDeleteTeamProfile: boolean;
  isGlobalAdmin: boolean;
  teamForm: {
    id: string;
    name: string;
    code: string;
    country: string;
    logo_url: string;
    api_team_id: string;
    source_provider: string;
    is_national: boolean;
  };
}>();

const emit = defineEmits<{
  loadTeamProfiles: [];
  saveTeamProfile: [];
  resetTeamForm: [];
  editTeamProfile: [item: any];
  deleteTeamProfile: [item: any];
  "update:teamsSearch": [value: string];
  "update:forceDeleteTeamProfile": [value: boolean];
}>();
</script>

<template>
  <article class="pitch-panel rounded-2xl p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl text-white">Catalogo de selecciones</h2>
        <p class="mt-1 text-sm text-(--text-muted)">
          Busca, edita o agrega equipos para controlar nombre, escudo y
          metadatos locales.
        </p>
      </div>
      <button
        class="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="emit('loadTeamProfiles')"
      >
        Refrescar equipos
      </button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
      <input
        :value="teamsSearch"
        class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
        placeholder="Buscar por nombre, codigo o pais"
        @input="
          emit('update:teamsSearch', ($event.target as HTMLInputElement).value)
        "
        @keyup.enter="emit('loadTeamProfiles')"
      />
      <button
        class="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
        @click="emit('loadTeamProfiles')"
      >
        Buscar
      </button>
    </div>

    <div class="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <h3 class="text-lg text-emerald-200">
        {{ teamForm.id ? "Editar seleccion" : "Agregar seleccion" }}
      </h3>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            Nombre
          </label>
          <input
            v-model="teamForm.name"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="Ej. Mexico"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            Codigo
          </label>
          <input
            v-model="teamForm.code"
            maxlength="5"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 uppercase text-slate-100 outline-none focus:border-emerald-400"
            placeholder="MEX"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            Pais
          </label>
          <input
            v-model="teamForm.country"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="Mexico"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            API team id
          </label>
          <input
            v-model="teamForm.api_team_id"
            inputmode="numeric"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="1234"
          />
        </div>

        <div class="space-y-1 md:col-span-2">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            Logo URL
          </label>
          <input
            v-model="teamForm.logo_url"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="https://media.api-sports.io/football/teams/...png"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-xs uppercase tracking-[0.12em] text-(--text-muted)"
          >
            Source provider
          </label>
          <input
            v-model="teamForm.source_provider"
            class="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
            placeholder="manual"
          />
        </div>

        <label
          class="inline-flex items-center gap-2 pt-6 text-sm text-slate-100"
        >
          <input
            v-model="teamForm.is_national"
            type="checkbox"
            class="h-4 w-4 rounded border-white/20 bg-black/50"
          />
          Seleccion nacional
        </label>

        <label
          v-if="isGlobalAdmin"
          class="inline-flex items-center gap-2 pt-6 text-sm text-amber-100"
        >
          <input
            :checked="forceDeleteTeamProfile"
            type="checkbox"
            class="h-4 w-4 rounded border-white/20 bg-black/50"
            @change="
              emit(
                'update:forceDeleteTeamProfile',
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          Forzar eliminacion de equipo
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          class="rounded-full border border-emerald-300/45 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-200 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="savingTeamProfile"
          @click="emit('saveTeamProfile')"
        >
          {{
            savingTeamProfile
              ? "Guardando..."
              : teamForm.id
                ? "Guardar cambios"
                : "Agregar equipo"
          }}
        </button>
        <button
          v-if="teamForm.id"
          class="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-100 transition hover:border-white/35"
          @click="emit('resetTeamForm')"
        >
          Cancelar edicion
        </button>
      </div>

      <p
        v-if="teamsMessage"
        class="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
      >
        {{ teamsMessage }}
      </p>
      <p
        v-if="teamsError"
        class="mt-3 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        {{ teamsError }}
      </p>
    </div>

    <p class="mt-4 text-xs text-(--text-muted)">
      Equipos encontrados: {{ teamsTotal }}
    </p>

    <p v-if="teamsLoading" class="mt-3 text-sm text-(--text-muted)">
      Cargando equipos...
    </p>

    <div v-else class="mt-3 overflow-hidden rounded-xl border border-white/8">
      <table class="min-w-full text-sm">
        <thead
          class="bg-black/35 text-left text-xs uppercase tracking-[0.12em] text-(--text-muted)"
        >
          <tr>
            <th class="px-4 py-3">Logo</th>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Codigo</th>
            <th class="px-4 py-3">Pais</th>
            <th class="px-4 py-3">Fuente</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="team in teamProfiles"
            :key="team.id"
            class="border-t border-white/8"
          >
            <td class="px-4 py-3">
              <img
                v-if="team.logo_url"
                :src="team.logo_url"
                :alt="`Escudo ${team.name}`"
                class="h-8 w-8 rounded-full bg-white/10 object-contain"
                loading="lazy"
              />
              <span v-else class="text-(--text-muted)">--</span>
            </td>
            <td class="px-4 py-3">
              <p class="font-semibold text-slate-100">{{ team.name }}</p>
              <p class="text-xs text-(--text-muted)">{{ team.team_key }}</p>
            </td>
            <td class="px-4 py-3 uppercase">{{ team.code || "--" }}</td>
            <td class="px-4 py-3">{{ team.country || "--" }}</td>
            <td class="px-4 py-3">{{ team.source_provider }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  class="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-100 transition hover:border-emerald-300/45 hover:text-emerald-100"
                  @click="emit('editTeamProfile', team)"
                >
                  Editar
                </button>
                <button
                  v-if="isGlobalAdmin"
                  class="rounded-full border border-red-300/25 px-3 py-1 text-xs text-red-100 transition hover:border-red-200 hover:text-red-50 disabled:opacity-55"
                  :disabled="deletingTeamProfileId === team.id"
                  @click="emit('deleteTeamProfile', team)"
                >
                  {{
                    deletingTeamProfileId === team.id
                      ? "Eliminando..."
                      : "Eliminar"
                  }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="teamProfiles.length === 0" class="border-t border-white/8">
            <td class="px-4 py-4 text-(--text-muted)" colspan="6">
              No hay equipos en el catalogo para este filtro.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
