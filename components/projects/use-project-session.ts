"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import {
  createProjectSession,
  type ProjectSession,
  type ProjectSessionDeps,
  type ProjectSessionSnapshot,
} from "@/lib/projects/client"

export type UseProjectSessionOptions = ProjectSessionDeps & {
  /** Existing session instance (takes precedence over deps). */
  session?: ProjectSession
  /** Attach beforeunload warnings while the hook is mounted. Default true. */
  guardNavigation?: boolean
}

/**
 * Subscribes to a ProjectSession snapshot for reusable project UI.
 * Does not render a musical editor — only project lifecycle/state.
 */
export function useProjectSession(
  options: UseProjectSessionOptions = {},
): {
  session: ProjectSession
  snapshot: ProjectSessionSnapshot
} {
  const { session: provided, guardNavigation = true, ...deps } = options

  const session = useMemo(
    () => provided ?? createProjectSession(deps),
    // Session identity is fixed for the hook lifetime; callers pass a stable instance when needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provided],
  )

  const snapshot = useSyncExternalStore(
    (onStoreChange) => session.subscribe(onStoreChange),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  )

  useEffect(() => {
    if (!guardNavigation) return
    return session.getNavigationGuard().attach()
  }, [session, guardNavigation])

  useEffect(() => {
    if (provided) return
    return () => session.dispose()
  }, [provided, session])

  return { session, snapshot }
}
