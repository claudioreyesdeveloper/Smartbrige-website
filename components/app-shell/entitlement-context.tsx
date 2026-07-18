"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { mockEntitlementProvider } from "./mock-entitlement-provider"
import type { EntitlementProvider, ServiceEntitlement } from "./types"

const EntitlementContext = createContext<EntitlementProvider | null>(null)

type EntitlementProviderProps = {
  children: ReactNode
  provider?: EntitlementProvider
}

export function EntitlementProviderBoundary({
  children,
  provider = mockEntitlementProvider,
}: EntitlementProviderProps) {
  const value = useMemo(() => provider, [provider])
  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  )
}

export function useEntitlements(): ServiceEntitlement[] {
  const provider = useContext(EntitlementContext)
  if (!provider) {
    throw new Error("useEntitlements must be used within EntitlementProviderBoundary")
  }
  return provider.getEntitlements()
}

export function useEntitlementProvider(): EntitlementProvider {
  const provider = useContext(EntitlementContext)
  if (!provider) {
    throw new Error("useEntitlementProvider must be used within EntitlementProviderBoundary")
  }
  return provider
}
