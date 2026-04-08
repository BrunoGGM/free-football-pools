<script setup lang="ts">
defineProps<{
  isGlobalAdmin: boolean;
  globalLoading: boolean;
  globalError: string | null;
  globalMessage: string | null;
  globalStats: {
    totals?: {
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
    has_test_data: boolean;
    ticket_price: number;
    start_date: string;
    admin_id: string;
    admin_username: string;
    rules: {
      exact_score_points: number;
      correct_outcome_points: number;
      champion_bonus_points: number;
      allow_member_predictions_view: boolean;
    };
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
    exact_score_points: number;
    correct_outcome_points: number;
    champion_bonus_points: number;
    allow_member_predictions_view: boolean;
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
  simulationForm: {
    quiniela_id: string;
    segment:
      | "all"
      | "group_stage"
      | "round_32"
      | "round_16"
      | "quarter_final"
      | "semi_final"
      | "third_place"
      | "final";
    simulate_scores: boolean;
    simulate_population: boolean;
    test_users_count: number;
    reset_test_data: boolean;
  };
  runningSimulation: boolean;
  clearingSimulationData: boolean;
  simulationMessage: string | null;
  simulationError: string | null;
}>();

const emit = defineEmits<{
  randomAccessCode: [];
  saveQuiniela: [];
  resetQuinielaForm: [];
  editQuiniela: [item: any];
  deleteQuiniela: [id: string];
  applyManualPoints: [];
  runSimulation: [];
  clearSimulationData: [];
}>();
</script>

<template>
  <article
    class="pitch-panel card rounded-2xl border border-base-300 bg-base-200/70 p-5"
  >
    <h2 class="text-base-content text-xl">
      {{ isGlobalAdmin ? "Dashboard global" : "Gestion de tu quiniela" }}
    </h2>
    <p class="text-base-content/70 mt-2 text-sm">
      {{
        isGlobalAdmin
          ? "Como global admin puedes ver metricas totales y gestionar quinielas de toda la plataforma."
          : "Como admin local puedes configurar solo tus quinielas y aplicar ajustes a tus jugadores."
      }}
    </p>

    <p v-if="globalLoading" class="text-base-content/70 mt-4 text-sm">
      Cargando panel de administracion...
    </p>

    <p v-else-if="globalError" class="alert alert-error mt-4 text-sm">
      {{ globalError }}
    </p>

    <template v-else-if="globalStats">
      <div
        v-if="isGlobalAdmin"
        class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Usuarios
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.users ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Global admins
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.globalAdmins ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Quinielas
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.quinielas ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Miembros
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.members ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Partidos
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.matches ?? 0 }}
          </p>
        </div>
        <div class="card rounded-xl border border-base-300 bg-base-100/70 p-4">
          <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
            Predicciones
          </p>
          <p class="text-base-content mt-1 text-2xl font-semibold">
            {{ globalStats.totals?.predictions ?? 0 }}
          </p>
        </div>
      </div>

      <div v-else class="alert alert-info mt-4 rounded-xl text-sm">
        Alcance local: puedes editar configuracion de tus quinielas y aplicar
        ajustes manuales de puntos a tus jugadores.
      </div>

      <div
        class="card mt-6 rounded-xl border border-base-300 bg-base-100/70 p-4"
      >
        <h3 class="text-primary text-lg">
          {{
            quinielaForm.id
              ? "Editar quiniela"
              : isGlobalAdmin
                ? "Crear quiniela"
                : "Selecciona una quiniela para editar"
          }}
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

          <div v-if="isGlobalAdmin" class="space-y-1">
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

          <div class="space-y-1 md:col-span-2">
            <p class="text-base-content/70 text-xs uppercase tracking-[0.12em]">
              Reglas de puntuacion
            </p>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Puntos marcador exacto
            </label>
            <input
              v-model.number="quinielaForm.exact_score_points"
              type="number"
              min="1"
              max="20"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Puntos por signo
            </label>
            <input
              v-model.number="quinielaForm.correct_outcome_points"
              type="number"
              min="0"
              max="20"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Bonus campeon
            </label>
            <input
              v-model.number="quinielaForm.champion_bonus_points"
              type="number"
              min="0"
              max="100"
              step="1"
              class="input input-bordered w-full"
            />
          </div>

          <div class="space-y-1 md:col-span-2">
            <p class="text-base-content/60 text-xs">
              Solo se configuran puntos por signo, marcador exacto y campeon.
            </p>
          </div>

          <div class="space-y-1 md:col-span-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="quinielaForm.allow_member_predictions_view"
                type="checkbox"
                class="toggle toggle-primary"
              />
              <div>
                <span
                  class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
                >
                  Ver quiniela de otros miembros
                </span>
                <p class="text-base-content/60 mt-1 text-xs normal-case">
                  Si esta activo, los miembros podran abrir el listado de
                  predicciones de otros usuarios desde posiciones.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-if="isGlobalAdmin || quinielaForm.id"
            class="btn btn-primary btn-sm"
            :disabled="savingQuiniela || (!isGlobalAdmin && !quinielaForm.id)"
            @click="emit('saveQuiniela')"
          >
            {{
              savingQuiniela
                ? "Guardando..."
                : isGlobalAdmin
                  ? quinielaForm.id
                    ? "Guardar cambios"
                    : "Crear quiniela"
                  : "Guardar configuracion"
            }}
          </button>
          <button
            v-if="quinielaForm.id"
            class="btn btn-outline btn-sm"
            @click="emit('resetQuinielaForm')"
          >
            {{ isGlobalAdmin ? "Cancelar edicion" : "Limpiar seleccion" }}
          </button>
        </div>

        <p
          v-if="!isGlobalAdmin && !quinielaForm.id"
          class="text-base-content/70 mt-3 text-xs"
        >
          Selecciona primero una quiniela en la tabla para cargar su
          configuracion.
        </p>

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

      <div
        v-if="isGlobalAdmin"
        class="card mt-6 rounded-xl border border-warning/40 bg-base-100/70 p-4"
      >
        <h3 class="text-warning text-lg">Simulacion de pruebas</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Ejecuta poblacion y marcadores aleatorios por segmento para validar
          ranking, estadisticas y flujo de quiniela.
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Quiniela destino
            </label>
            <select
              v-model="simulationForm.quiniela_id"
              class="select select-bordered w-full"
            >
              <option value="">Selecciona quiniela</option>
              <option
                v-for="item in managedQuinielas"
                :key="`sim-${item.id}`"
                :value="item.id"
              >
                {{ item.name }} ({{ item.has_test_data ? "LOCK" : "OK" }})
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Segmento
            </label>
            <select
              v-model="simulationForm.segment"
              class="select select-bordered w-full"
            >
              <option value="all">Todo el torneo</option>
              <option value="group_stage">Fase de grupos</option>
              <option value="round_32">Dieciseisavos</option>
              <option value="round_16">Octavos</option>
              <option value="quarter_final">Cuartos</option>
              <option value="semi_final">Semifinal</option>
              <option value="third_place">Tercer lugar</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div class="space-y-1 md:col-span-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.simulate_scores"
                type="checkbox"
                class="toggle toggle-warning"
              />
              <span class="text-base-content/70 text-sm">
                Simular marcadores oficiales aleatorios para el segmento
              </span>
            </label>

            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.simulate_population"
                type="checkbox"
                class="toggle toggle-warning"
              />
              <span class="text-base-content/70 text-sm">
                Simular alta de usuarios y predicciones aleatorias
              </span>
            </label>

            <label class="label cursor-pointer justify-start gap-3">
              <input
                v-model="simulationForm.reset_test_data"
                type="checkbox"
                class="toggle toggle-warning"
                :disabled="!simulationForm.simulate_population"
              />
              <span class="text-base-content/70 text-sm">
                Limpiar registros de prueba previos antes de simular poblacion
              </span>
            </label>
          </div>

          <div class="space-y-1">
            <label
              class="text-base-content/70 text-xs uppercase tracking-[0.12em]"
            >
              Usuarios de prueba
            </label>
            <input
              v-model.number="simulationForm.test_users_count"
              type="number"
              min="1"
              max="120"
              step="1"
              class="input input-bordered w-full"
              :disabled="!simulationForm.simulate_population"
            />
          </div>
        </div>

        <p class="alert alert-warning mt-3 text-xs">
          Si la quiniela contiene registros de prueba, queda bloqueada para
          usuarios reales hasta limpiar datos simulados.
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            class="btn btn-warning btn-sm"
            :disabled="runningSimulation"
            @click="emit('runSimulation')"
          >
            {{ runningSimulation ? "Simulando..." : "Ejecutar simulacion" }}
          </button>
          <button
            class="btn btn-outline btn-sm"
            :disabled="clearingSimulationData"
            @click="emit('clearSimulationData')"
          >
            {{
              clearingSimulationData
                ? "Limpiando..."
                : "Limpiar registros de prueba"
            }}
          </button>
        </div>

        <p v-if="simulationMessage" class="alert alert-success mt-3 text-xs">
          {{ simulationMessage }}
        </p>
        <p v-if="simulationError" class="alert alert-error mt-3 text-xs">
          {{ simulationError }}
        </p>
      </div>

      <div class="mt-6 overflow-hidden rounded-xl border border-base-300">
        <table class="table min-w-full text-sm">
          <thead
            class="bg-base-200 text-base-content/70 text-left text-xs uppercase tracking-[0.12em]"
          >
            <tr>
              <th class="px-4 py-3">Quiniela</th>
              <th v-if="isGlobalAdmin" class="px-4 py-3">Admin</th>
              <th class="px-4 py-3">Boleto</th>
              <th class="px-4 py-3">Codigo</th>
              <th class="px-4 py-3">Reglas</th>
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
              <td v-if="isGlobalAdmin" class="px-4 py-3">
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
              <td class="text-base-content/70 px-4 py-3 text-xs">
                E{{ item.rules.exact_score_points }} / S{{
                  item.rules.correct_outcome_points
                }}
                / C{{ item.rules.champion_bonus_points }}
                <span class="block mt-1">
                  Quiniela visible:
                  {{ item.rules.allow_member_predictions_view ? "SI" : "NO" }}
                </span>
                <span class="block mt-1">
                  Lock pruebas:
                  {{ item.has_test_data ? "ACTIVO" : "INACTIVO" }}
                </span>
              </td>
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
                    v-if="isGlobalAdmin"
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
            <tr
              v-if="managedQuinielas.length === 0"
              class="border-t border-base-300"
            >
              <td
                class="text-base-content/70 px-4 py-4"
                :colspan="isGlobalAdmin ? 7 : 6"
              >
                No hay quinielas disponibles para tu alcance de administracion.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </article>
</template>
