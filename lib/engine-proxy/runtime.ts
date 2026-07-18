import { JamEngineService } from "@/lib/engine-proxy/service"

let defaultService: JamEngineService | undefined

export function getJamEngineService(): JamEngineService {
  if (!defaultService) {
    defaultService = new JamEngineService()
  }
  return defaultService
}

export function setJamEngineServiceForTests(service: JamEngineService | undefined): void {
  defaultService = service
}

export function resetJamEngineRuntimeForTests(): void {
  defaultService = undefined
}
