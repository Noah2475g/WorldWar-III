import type {
  AiMemory,
  Command,
  DifficultyRule,
  MapData,
  PlayerId,
  ProvinceId,
  PublicView,
  Rules,
} from '@worldwar/core'
import type { Fixed } from '@worldwar/shared'

/**
 * The computer opponent (R-AI-01, design D8/D-10).
 *
 * `decide` sees exactly what a human player sees — a PublicView, nothing else — and
 * answers with commands that go through the same validation. That is what makes
 * "the AI cannot cheat" a property of the architecture rather than a promise.
 */

export interface AiContext {
  view: PublicView
  memory: AiMemory
  rules: Rules
  /** The map is public knowledge: geography is not a secret. */
  map: MapData
  difficulty: DifficultyRule
}

export interface Explanation {
  /** What was decided. */
  action: string
  /** Why, in one line a human can read. */
  reason: string
  /** Utility score of the chosen option, 0..1000. */
  score: Fixed
  /** The runner-up, so the debug view can show what was almost done instead. */
  alternative?: { action: string; score: Fixed }
}

export interface AiDecision {
  commands: Command[]
  /** The updated memory — the AI's plans survive into the next tick and the save. */
  memory: AiMemory
  /** Only filled in debug mode (R-AI-05). */
  explanations: Explanation[]
}

export interface ProvinceValue {
  id: ProvinceId
  /** 0..1000 each, so the weights in ai.json are real priorities. */
  economy: Fixed
  position: Fixed
  defence: Fixed
  distance: Fixed
  weakness: Fixed
  total: Fixed
  owner: PlayerId | null
}
