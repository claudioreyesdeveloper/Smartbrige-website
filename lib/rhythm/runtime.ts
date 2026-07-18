import { RhythmService } from "@/lib/rhythm/service"

let defaultService: RhythmService | undefined

export function getRhythmService(): RhythmService {
  if (!defaultService) defaultService = new RhythmService()
  return defaultService
}

export function setRhythmServiceForTests(service: RhythmService | undefined): void {
  defaultService = service
}
