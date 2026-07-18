export type ProjectTimerHandle = {
  clear(): void
}

export type ProjectTimer = {
  setTimeout(callback: () => void, delayMs: number): ProjectTimerHandle
}

export type ProjectClock = {
  now(): number
}

export const browserClock: ProjectClock = {
  now() {
    return typeof performance !== "undefined" ? performance.now() : Date.now()
  },
}

export const browserTimer: ProjectTimer = {
  setTimeout(callback, delayMs) {
    const id = setTimeout(callback, Math.max(0, delayMs))
    return {
      clear() {
        clearTimeout(id)
      },
    }
  },
}
