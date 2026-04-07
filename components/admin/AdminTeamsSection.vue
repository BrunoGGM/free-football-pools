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
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base-content text-xl">Catalogo de selecciones</h2>
        <p class="text-base-content/70 mt-1 text-sm">
          Busca, edita o agrega equipos para controlar nombre, escudo y
          metadatos locales.
        </p>
      </div>
      <button class="btn btn-outline btn-sm" @click="emit('loadTeamProfiles')">
        Refrescar equipos
      </button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
      <input
        :value="teamsSearch"
        class="input input-bordered w-full"
        placeholder="Buscar por nombre, codigo o pais"
        @input="
          emit('update:teamsSearch', ($event.target as HTMLInputElement).value)
        "
        @keyup.enter="emit('loadTeamProfiles')"
      />
      <button class="btn btn-outline" @click="emit('loadTeamProfiles')">
        Buscar
      </button>
    </div>

    <div class="card mt-4 rounded-xl border border-base-300 bg-base-100/70 p-4">
      <h3 class="text-primary text-lg">
        {{ teamForm.id ? "Editar seleccion" : "Agregar seleccion" }}
      </h3>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="space-y-1">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            Nombre
          </label>
          <input
            v-model="teamForm.name"
            class="input input-bordered w-full"
            placeholder="Ej. Mexico"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            Codigo
          </label>
          <input
            v-model="teamForm.code"
            maxlength="5"
            class="input input-bordered w-full uppercase"
            placeholder="MEX"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            Pais
          </label>
          <input
            v-model="teamForm.country"
            class="input input-bordered w-full"
            placeholder="Mexico"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            API team id
          </label>
          <input
            v-model="teamForm.api_team_id"
            inputmode="numeric"
            class="input input-bordered w-full"
            placeholder="1234"
          />
        </div>

        <div class="space-y-1 md:col-span-2">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            Logo URL
          </label>
          <input
            v-model="teamForm.logo_url"
            class="input input-bordered w-full"
            placeholder="https://media.api-sports.io/football/teams/...png"
          />
        </div>

        <div class="space-y-1">
          <label
            class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
          >
            Source provider
          </label>
          <input
            v-model="teamForm.source_provider"
            class="input input-bordered w-full"
            placeholder="manual"
          />
        </div>

        <label
          class="label cursor-pointer inline-flex items-center gap-2 pt-6 text-sm"
        >
          <input
            v-model="teamForm.is_national"
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm"
          />
          Seleccion nacional
        </label>

        <label
          v-if="isGlobalAdmin"
          class="label cursor-pointer text-warning inline-flex items-center gap-2 pt-6 text-sm"
        >
          <input
            :checked="forceDeleteTeamProfile"
            type="checkbox"
            class="checkbox checkbox-warning checkbox-sm"
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
          class="btn btn-primary btn-sm"
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
          class="btn btn-outline btn-sm"
          @click="emit('resetTeamForm')"
        >
          Cancelar edicion
        </button>
      </div>

      <p v-if="teamsMessage" class="alert alert-success mt-3 text-xs">
        {{ teamsMessage }}
      </p>
      <p v-if="teamsError" class="alert alert-error mt-3 text-xs">
        {{ teamsError }}
      </p>
    </div>

    <p class="text-base-content/70 mt-4 text-xs">
      Equipos encontrados: {{ teamsTotal }}
    </p>

    <p v-if="teamsLoading" class="text-base-content/70 mt-3 text-sm">
      Cargando equipos...
    </p>

    <div v-else class="mt-3 overflow-hidden rounded-xl border border-base-300">
      <table class="table min-w-full text-sm">
        <thead
          class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
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
            class="border-t border-base-300"
          >
            <td class="px-4 py-3">
              <img
                v-if="team.logo_url"
                :src="team.logo_url"
                :alt="`Escudo ${team.name}`"
                class="h-8 w-8 rounded-full bg-base-200 object-contain"
                loading="lazy"
              />
              <span v-else class="text-base-content/70">--</span>
            </td>
            <td class="px-4 py-3">
              <p class="text-base-content font-semibold">{{ team.name }}</p>
              <p class="text-base-content/70 text-xs">{{ team.team_key }}</p>
            </td>
            <td class="px-4 py-3 uppercase">{{ team.code || "--" }}</td>
            <td class="px-4 py-3">{{ team.country || "--" }}</td>
            <td class="px-4 py-3">{{ team.source_provider }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-2">
                <button
                  class="btn btn-outline btn-xs"
                  @click="emit('editTeamProfile', team)"
                >
                  Editar
                </button>
                <button
                  v-if="isGlobalAdmin"
                  class="btn btn-error btn-outline btn-xs"
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
          <tr v-if="teamProfiles.length === 0" class="border-t border-base-300">
            <td class="text-base-content/70 px-4 py-4" colspan="6">
              No hay equipos en el catalogo para este filtro.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
