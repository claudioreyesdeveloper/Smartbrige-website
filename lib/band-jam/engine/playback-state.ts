import type { BandPart, PartMixState } from "@/lib/band-jam/engine/types"

/** Resolve the one effective mute state shared by browser audio and Web MIDI. */
export function effectivePartMuted(
  part: BandPart,
  mix: Record<BandPart, PartMixState>,
  soloed: BandPart | null,
): boolean {
  return soloed !== null ? part !== soloed : mix[part].muted
}

/**
 * Convert a monotonic AudioContext-time delta to elapsed musical beats.
 * The visible arrangement playhead may wrap at a loop; AudioContext time does not.
 */
export function elapsedBeatsForAudioTime(
  previousTime: number | null,
  currentTime: number,
  tempo: number,
  countingIn: boolean,
): number {
  if (previousTime === null || countingIn) return 0
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) return 0
  if (!Number.isFinite(tempo) || tempo <= 0) return 0
  const elapsedSeconds = Math.max(0, currentTime - previousTime)
  return elapsedSeconds * (tempo / 60)
}
