import { NAVIGATION_WARNING } from "@/lib/projects/client/types"

export type NavigationGuard = {
  /** Attach a `beforeunload` listener; returns an unsubscribe function. */
  attach(target?: Window): () => void
  /** For in-app route changes: returns false when navigation should be blocked. */
  confirmNavigation(confirmFn?: (message: string) => boolean): boolean
  shouldWarn(): boolean
  warningMessage: string
}

export function createNavigationGuard(
  shouldWarn: () => boolean,
  warningMessage = NAVIGATION_WARNING,
): NavigationGuard {
  return {
    warningMessage,
    shouldWarn,
    attach(target = typeof window !== "undefined" ? window : undefined) {
      if (!target) return () => {}
      const handler = (event: BeforeUnloadEvent) => {
        if (!shouldWarn()) return
        event.preventDefault()
        event.returnValue = warningMessage
      }
      target.addEventListener("beforeunload", handler)
      return () => target.removeEventListener("beforeunload", handler)
    },
    confirmNavigation(confirmFn) {
      if (!shouldWarn()) return true
      const ask =
        confirmFn ??
        ((message: string) =>
          typeof window !== "undefined" ? window.confirm(message) : false)
      return ask(warningMessage)
    },
  }
}
