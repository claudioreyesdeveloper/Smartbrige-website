import { CreativeService } from "@/lib/creative/service"

let service: CreativeService | undefined

export function getCreativeService(): CreativeService {
  if (!service) service = new CreativeService()
  return service
}

export function setCreativeServiceForTests(value: CreativeService | undefined): void {
  service = value
}
