export type GameUxEventType =
  | "prediction-saved"
  | "champion-saved"
  | "exact-hit"
  | "rank-up"

export interface GameUxEvent {
  id: number
  type: GameUxEventType
  createdAt: number
  payload?: Record<string, unknown>
}

export function useGameUx() {
  const sequence = useState<number>("game-ux-sequence", () => 0)
  const lastEvent = useState<GameUxEvent | null>("game-ux-last-event", () => null)

  const emitEvent = (type: GameUxEventType, payload?: Record<string, unknown>) => {
    sequence.value += 1
    lastEvent.value = {
      id: sequence.value,
      type,
      createdAt: Date.now(),
      payload,
    }
  }

  const emitPredictionSaved = (payload?: Record<string, unknown>) => {
    emitEvent("prediction-saved", payload)
  }

  const emitChampionSaved = (payload?: Record<string, unknown>) => {
    emitEvent("champion-saved", payload)
  }

  const emitExactHit = (payload?: Record<string, unknown>) => {
    emitEvent("exact-hit", payload)
  }

  const emitRankUp = (payload?: Record<string, unknown>) => {
    emitEvent("rank-up", payload)
  }

  return {
    lastEvent,
    emitEvent,
    emitPredictionSaved,
    emitChampionSaved,
    emitExactHit,
    emitRankUp,
  }
}
