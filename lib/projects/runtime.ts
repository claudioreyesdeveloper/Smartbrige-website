import { NeonProjectStore } from "@/lib/projects/neon-store"
import { ProjectService } from "@/lib/projects/service"

let defaultService: ProjectService | undefined

export function getProjectService(): ProjectService {
  if (!defaultService) {
    defaultService = new ProjectService(new NeonProjectStore())
  }
  return defaultService
}

/** Test helper to replace the singleton. */
export function setProjectServiceForTests(service: ProjectService | undefined): void {
  defaultService = service
}
