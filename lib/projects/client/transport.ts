/**
 * Playback/audition surface that suspends all project network saves while active.
 * Audition players call `setActive(true)` on start and `setActive(false)` on stop.
 */
export type TransportActivity = {
  isActive(): boolean
  setActive(active: boolean): void
  subscribe(listener: (active: boolean) => void): () => void
}

export function createTransportActivity(initial = false): TransportActivity {
  let active = initial
  const listeners = new Set<(active: boolean) => void>()

  return {
    isActive() {
      return active
    },
    setActive(next) {
      if (active === next) return
      active = next
      for (const listener of listeners) listener(active)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
