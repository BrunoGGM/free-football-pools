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
    ticket_price: number;
    start_date: string;
    admin_id: string;
    admin_username: string;
  }>;
  quinielaForm: {
    id: string;
    name: string;
    description: string;
    access_code: string;
    ticket_price: number;
    start_date: string;
    end_date: string;
    admin_id: string;
  };
  savingQuiniela: boolean;
  deletingQuinielaId: string | null;
  manualPointsForm: {
    quiniela_id: string;
    user_id: string;
    points_delta: number;
    reason: string;
  };
  applyingManualPoints: boolean;
  manualPointsMessage: string | null;
  manualPointsError: string | null;
}>();

const emit = defineEmits<{
  randomAccessCode: [];
  saveQuiniela: [];
  resetQuinielaForm: [];
  editQuiniela: [item: any];
  deleteQuiniela: [id: string];
  applyManualPoints: [];
}>();
</script>

<template>
  <article
    v-if="isGlobalAdmin"
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">Dashboard global</h2>
    <p class="text-base-content/70 mt-2 text-sm">
      Como global admin puedes ver metricas totales y gestionar quinielas de
      toda la plataforma.
    </p>

    <p v-if="globalLoading" class="text-base-content/70 mt-4 text-sm">
      Cargando dashboard global...
    </p>

    <p v-else-if="globalError" class="alert alert-error mt-4 text-sm">
      {{ globalError }}
    </p>

    <template v-else-if="globalStats">
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Usuarios
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.users }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Global admins
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.globalAdmins }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Quinielas
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.quinielas }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Miembros
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.members }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Partidos
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.matches }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Predicciones
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals.predictions }}
          </p>
        </div>
      </div>

      <div
        class="card mt-6 rounded-xl border border-base-300 bg-base-100/70 p-4"
      >
        <h3 class="text-primary text-lg">
          {{ quinielaForm.id ? "Editar quiniela" : "Crear quiniela" }}
        </h3>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Nombre
            </label>
            <input
              v-model="quinielaForm.name"
              class="input input-bordered w-full"
              placeholder="Quiniela principal"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Access code
            </label>
            <div class="flex gap-2">
              <input
                v-model="quinielaForm.access_code"
                maxlength="12"
                class="input input-bordered w-full uppercase"
                placeholder="ABC123"
              />
              <button
                class="btn btn-outline btn-sm"
                @click="emit('randomAccessCode')"
              >
                Generar
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Admin user id
            </label>
            <input
              v-model="quinielaForm.admin_id"
              class="input input-bordered w-full"
              placeholder="uuid del admin"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Costo por boleto
            </label>
            <input
              v-model.number="quinielaForm.ticket_price"
              type="number"
              min="0"
              step="0.01"
              class="input input-bordered w-full"
              placeholder="0.00"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Inicio
            </label>
            <input
              v-model="quinielaForm.start_date"
              type="datetime-local"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Fin (opcional)
            </label>
            <input
              v-model="quinielaForm.end_date"
              type="datetime-local"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Descripcion
            </label>
            <textarea
              v-model="quinielaForm.description"
              rows="3"
              class="textarea textarea-bordered w-full"
              placeholder="Descripcion de la quiniela"
            />
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="btn btn-primary btn-sm"
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
            class="btn btn-outline btn-sm"
            @click="emit('resetQuinielaForm')"
          >
            Cancelar edicion
          </button>
        </div>

        <p v-if="globalMessage" class="alert alert-success mt-3 text-xs">
          {{ globalMessage }}
        </p>

        <p v-if="globalError" class="alert alert-error mt-3 text-xs">
          {{ globalError }}
        </p>
      </div>

      <div
        class="card mt-6 rounded-xl border border-base-300 bg-base-100/70 p-4"
      >
        <h3 class="text-primary text-lg">Ajuste manual de puntos</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Registra bonos o penalizaciones por usuario. El ranking se recalcula
          automaticamente con historial de auditoria.
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Quiniela
            </label>
            <select
              v-model="manualPointsForm.quiniela_id"
              class="select select-bordered w-full"
            >
              <option value="">Selecciona quiniela</option>
              <option
                v-for="item in managedQuinielas"
                :key="`adj-${item.id}`"
                :value="item.id"
              >
                {{ item.name }} ({{ item.access_code }})
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              User id
            </label>
            <input
              v-model="manualPointsForm.user_id"
              class="input input-bordered w-full"
              placeholder="UUID del miembro"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Ajuste de puntos
            </label>
            <input
              v-model.number="manualPointsForm.points_delta"
              type="number"
              step="1"
              class="input input-bordered w-full"
              placeholder="Ej: 2 o -1"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Motivo
            </label>
            <input
              v-model="manualPointsForm.reason"
              maxlength="240"
              class="input input-bordered w-full"
              placeholder="Bonus por dinamica semanal / Penalizacion por regla"
            />
          </div>
        </div>

        <div class="mt-4">
          <button
            class="btn btn-secondary btn-sm"
            :disabled="applyingManualPoints"
            @click="emit('applyManualPoints')"
          >
            {{ applyingManualPoints ? "Aplicando..." : "Aplicar ajuste" }}
          </button>
        </div>

        <p v-if="manualPointsMessage" class="alert alert-success mt-3 text-xs">
          {{ manualPointsMessage }}
        </p>
        <p v-if="manualPointsError" class="alert alert-error mt-3 text-xs">
          {{ manualPointsError }}
        </p>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-base-300">
        <table class="table min-w-full text-sm">
          <thead
            class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
          >
            <tr>
              <th class="px-4 py-3">Quiniela</th>
              <th class="px-4 py-3">Admin</th>
              <th class="px-4 py-3">Boleto</th>
              <th class="px-4 py-3">Codigo</th>
              <th class="px-4 py-3">Inicio</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in managedQuinielas"
              :key="item.id"
              class="border-t border-base-300"
            >
              <td class="px-4 py-3">
                <p class="text-base-content font-semibold">{{ item.name }}</p>
                <p class="text-base-content/70 text-xs">
                  {{ item.description || "Sin descripcion" }}
                </p>
              </td>
              <td class="px-4 py-3">
                <p class="text-base-content">{{ item.admin_username }}</p>
                <p class="text-base-content/70 text-xs">{{ item.admin_id }}</p>
              </td>
              <td class="text-warning px-4 py-3 font-semibold">
                {{
                  Number(item.ticket_price || 0).toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })
                }}
              </td>
              <td class="px-4 py-3 uppercase">{{ item.access_code }}</td>
              <td class="text-base-content/70 px-4 py-3">
                {{ new Date(item.start_date).toLocaleString("es-MX") }}
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2">
                  <button
                    class="btn btn-outline btn-xs"
                    @click="emit('editQuiniela', item)"
                  >
                    Editar
                  </button>
                  <button
                    class="btn btn-error btn-outline btn-xs"
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

  <article v-else class="alert alert-warning rounded-2xl p-5">
    <h2 class="text-xl">Acceso admin local</h2>
    <p class="mt-2 text-sm">
      Tu acceso actual permite administrar la quiniela activa. El dashboard
      global solo aparece para usuarios con flag is_global_admin.
    </p>
  </article>
</template>
